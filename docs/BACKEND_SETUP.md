# Brewsy backend setup

This puts Brewsy's "newsroom" online so a fresh edition is waiting every morning, for you and for the
friends you share the app with, at **$0 a month**.

```
every 10 min   Supabase timer (pg_cron) ──► daily-briefing function: sends the morning pushes that are due,
                                            then does the next heavy job
                 ~30 min before you wake        EDITION  reads ~150 world feeds (~1,500 articles), groups them into
                                                         stories, scores importance; the AI picks + writes ~12–18
                                                         stories, an "editor" pass checks for misses, "Also happening"
                 right after                    AUDIO    radio scripts (Quick ≈ 3 min, Full ≈ 10 min), read aloud by the phone
                 05:00 in each reader's region  LOCAL    India, US, UK, Canada, Australia: 1–2 local stories + 4–6 one-liners
                 before each region's 05:00,    UPDATE   new major stories → "Since this morning"
                 and twice in your day                   (+ max 2 breaking pushes, only 7am–10pm where each reader is)
                 each reader's own wake time    PUSH     "Your Brewsy edition is ready"
in the app     Today tab ──► the world edition + the reader's local section + updates
               "Go deeper" / "Ask" ──► go-deeper / ask (daily caps)
```

**You and your friends.** Brewsy has one owner (you) and any number of friends. Everyone reads the same
world edition. *Your* phone decides when it's written (30 minutes before your wake time) and gets the alerts.
Each friend gets their own region's local section and their own morning push at their own wake time.
Nobody signs in: each phone is a random device ID.

Setup takes about 30 minutes. You type commands in a terminal, in the Brewsy project folder:

```bash
cd ~/Documents/brewsy
```

> **Keep secrets out of screenshots and chats.** Your AI keys, your `CRON_SECRET` and your Supabase
> *secret* key should never be shared or committed. The Supabase *publishable* key is fine to put in the app.

> **Already running Brewsy on Claude and OpenAI?** Read [Moving to the free setup](#moving-an-existing-brewsy-to-the-free-setup)
> first. The order matters.

## What it costs per month

| Service | What for | Cost |
| --- | --- | --- |
| Supabase (free plan) | Database, functions, timer, storage | $0 |
| Cloudflare Workers AI (Workers Free plan) | Writing the world edition; overflow for everything else | $0 (10,000 free neurons a day) |
| Groq (free plan) | Audio scripts, local sections, "Since this morning", Go deeper, Ask | $0 |
| No voice service (`TTS_PROVIDER=none`) | The phone reads the radio script aloud | $0 |
| Resend (optional) | Alert emails | $0 (free plan) |
| Expo push notifications | Morning + breaking pushes | $0 |

**Total: $0.** Free tiers come with daily limits, so Brewsy counts every AI call and skips a model before it
reaches its limit (see [The free AI budget](#the-free-ai-budget)). The paid options still work if you ever want
them: Claude for writing (`LLM_ROUTES`, see [Changing the AI](#changing-the-ai)) and a real voice
(`TTS_PROVIDER=openai` or `elevenlabs`, see `supabase/functions/_shared/audio-config.ts`).

---

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up, and click **New project**.
2. Name: `brewsy`. Database password: click **Generate** and save it in a password manager.
   Region: **South Asia (Mumbai)** (closest to India).
3. Wait about two minutes for it to finish.
4. Find your **project ref**. It's the code in the dashboard address:
   `supabase.com/dashboard/project/`**`abcdefghijklmnop`**. You'll use it below wherever you see `YOUR-PROJECT-REF`.

## 2. Get the AI keys (two free accounts)

Not used: Mistral (its free plan no longer includes API keys) and SambaNova (in October 2026 its "free tier"
answered every model with `402 PAYMENT_METHOD_REQUIRED`). Never add a card to either; Brewsy doesn't need them.

**Groq (everything that fits in a small request):**

1. Go to <https://console.groq.com> and sign up (the free plan needs no card; don't upgrade it).
2. **API Keys → Create API Key**, copy the key.

**Cloudflare Workers AI (the world edition, and overflow):**

1. Sign up at <https://dash.cloudflare.com/sign-up/workers-and-pages> and stay on the **Workers Free** plan.
   On it, Workers AI simply stops at 10,000 neurons a day instead of billing.
2. In the dashboard open **AI → Workers AI → Use REST API**.
3. **Create a Workers AI API Token → Create API Token → Copy API Token.** (A token you make yourself needs
   `Workers AI - Read` and `Workers AI - Edit`.)
4. On the same page, copy the **Account ID**.

Which model does what, and the free limits, are in [The free AI budget](#the-free-ai-budget).

## 3. The voice (nothing to do)

Brewsy writes the audio briefing as a radio-style script and the phone reads it aloud, which costs nothing.
That's `TTS_PROVIDER=none` in step 4. If you ever want a real voice, `supabase/functions/_shared/audio-config.ts`
explains the OpenAI and ElevenLabs options and their prices.

## 4. Put your secrets in a local file

```bash
cp supabase/functions/.env.example supabase/functions/.env
openssl rand -hex 32
```

The second command prints a long random string. That's your **CRON_SECRET**. Open the file:

```bash
nano supabase/functions/.env
```

Fill in the lines, then press `Ctrl+O`, `Enter` and `Ctrl+X` to save and exit:

```
CRON_SECRET=paste-the-random-string
GROQ_API_KEY=gsk_...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
TTS_PROVIDER=none
```

Optional lines (explained in the file):

- `SEC_CONTACT_EMAIL`: turns on SEC 8-K filings (Apple, Nvidia, Tesla…). The SEC requires a contact
  email in every request; without it that source is skipped, which is fine.
- `RESEND_API_KEY` + `ALERT_EMAIL`: emails you when something goes wrong (step 13). Without them,
  alerts still arrive as a push notification.
- `ASK_CAP_DEVICE`, `ASK_CAP_TOTAL`, `DEEPER_CAP_DEVICE`, `DEEPER_CAP_TOTAL`, `AI_CAP_NO_DEVICE`: the daily
  caps on Ask and Go deeper (see [Ask and Go deeper caps](#ask-and-go-deeper-caps)).
- `LLM_ROUTES`: another order of AI models (see [Changing the AI](#changing-the-ai)).

This file is git-ignored, so it won't be committed.

## 5. Log in and link the project

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
```

`login` opens your browser so you can approve access. `link` asks for the database password from step 1.

## 6. Create the database tables, the audio storage and the timer

```bash
npx supabase db push
```

It lists the migrations (`brewsy_schema`, `brewsy_cron`, `brewsy_listen_coverage`, `brewsy_topics_focus`,
`brewsy_readers`, `brewsy_oceans`) and asks you to confirm. Type `Y`.
This creates the tables with their security rules, a public `audio` storage bucket, the run log
(`pipeline_runs`), `alerts`, the local sections (`regional_editions`), the AI usage counts (`ai_usage`), the
Ask / Go deeper log (`ai_requests`) and the schedule locks (`schedule_runs`). It turns on `pg_cron` and `pg_net`
and schedules a job called `brewsy-tick` every 10 minutes. The job does nothing until step 9.

## 7. Upload the secrets

```bash
npx supabase secrets set --env-file supabase/functions/.env
```

## 8. Deploy the three functions

```bash
npx supabase functions deploy daily-briefing go-deeper ask --use-api
```

`--use-api` builds the functions on Supabase's servers, so you don't need Docker.

## 9. Connect the timer

The timer needs your project address and the same `CRON_SECRET`. These go into a private table
that the app and the public API can't read.

In the dashboard open **SQL Editor** and click **New query**. Paste the following, then replace
both values (keep the quotes) and click **Run**:

```sql
insert into private.config (key, value) values
  ('project_url', 'https://YOUR-PROJECT-REF.supabase.co'),
  ('cron_secret', 'PASTE-THE-SAME-CRON_SECRET')
on conflict (key) do update set value = excluded.value;

-- Check: should show both keys (and only the length, not the secret).
select key, length(value) from private.config;
```

## 10. Make your first edition now

Back in the terminal (replace `YOUR-PROJECT-REF`):

```bash
export SB=https://YOUR-PROJECT-REF.supabase.co
export CRON_SECRET=$(grep '^CRON_SECRET=' supabase/functions/.env | cut -d= -f2-)
brewsy() { curl -s -X POST "$SB/functions/v1/daily-briefing" -H "x-brewsy-secret: $CRON_SECRET" -H "Content-Type: application/json" -d "$1"; echo; }
```

**Quick health check first (no AI, writes nothing, ≈ 10 seconds):**

```bash
brewsy '{"dryRun":true}'
brewsy '{"dryRun":true,"region":"IN"}'      # a region's local feeds (IN, US, UK, CA or AU)
```

The reply shows how many feeds answered (`feeds.ok` / `feeds.total`, and which failed), how many
articles and outlets came in, how many distinct stories they grouped into, and the top 25 stories with
their importance `score`, `breadth` (outlets), `majorOutlets`, `mustInclude` and the reasons (`why`).
`model` says which AI would write it (`cloudflare:@cf/openai/gpt-oss-120b` for the edition); `none` means no AI key
is set up.

**Write today's edition:**

```bash
brewsy '{"force":true}'
```

You should see `{"action":"generate",…,"status":"started"}`. Writing takes 2–3 minutes. Then, in the
dashboard, open **Table Editor → briefings**. Today's row should say `status = ready`. A few minutes
later `audio_status` turns `ready` too (the edition starts the audio run by itself).

**Other things you can trigger by hand:**

```bash
brewsy '{"stage":"audio"}'                        # write today's audio scripts (if they aren't written yet)
brewsy '{"stage":"audio","force":true}'           # write them again
brewsy '{"stage":"update","force":true}'          # a "Since this morning" check now, any time of day
brewsy '{"stage":"region","region":"IN"}'         # India's local section now (if it isn't made yet today)
brewsy '{"stage":"region","region":"CA","force":true}'   # Canada's, again
```

Each of these spends AI calls from the day's free allowance (an edition about 10, a local section 2),
so don't repeat them many times a day.

## 11. Point the app at your backend

1. In the dashboard click **Connect** (top of the page), or go to **Project Settings → API Keys**,
   and copy the **Publishable key**. It starts with `sb_publishable_`.
2. Create a file called `.env` in the project folder (next to `package.json`) with:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_paste-the-rest
   ```

3. Restart the app with a clean cache:

   ```bash
   npx expo start -c
   ```

The Today tab now shows the real edition instead of the sample.
Only ever put the **publishable** key in the app, never the secret key: anything in the app can be read by anyone who has it.

**Notifications** (morning, breaking news, alerts) need a *development build* of the app. On Android,
Expo Go can't receive push notifications. In Expo Go everything else works.

## 12. Mark your phone as the owner's

Open the app on your phone once (it saves its settings to the `devices` table), then in the SQL Editor:

```sql
-- Your devices, newest first. Yours is the one with your timezone and wake time, saved just now.
select device_id, platform, timezone, wake_time, region, is_owner, updated_at
from devices order by updated_at desc limit 10;

update devices set is_owner = true where device_id = 'PASTE-YOUR-DEVICE-ID';
```

The owner's device times the world edition and gets the alerts. If no device is marked, the most recently
saved device is used, which is fine while you're the only reader but not once friends join. Mark each phone
or tablet of yours the same way (the most recently saved owner device sets the timing). To unmark one:
`update devices set is_owner = false where device_id = '…';`.

Reinstalling the app gives the phone a new device id: mark the new one.

**Feedback inbox and Usage** open only on a phone you pair, not on every `is_owner` device. On your phone,
open Settings, long-press **Connected to your Brewsy backend** at the bottom, tap **Get a code**, and run
the line it shows in the SQL Editor:

```sql
select private.brewsy_approve_owner('AB12CD34');
```

Then tap **Check again** on the phone. The phone keeps a random key and the server only its SHA-256
(`private.owner_keys`); the `brewsy_owner_*` functions answer only to that key from that phone. Pairing
also leaves the paired phones as the only `is_owner` devices. Pair each phone of yours the same way, and
again after a reinstall. To unpair every phone: `delete from private.owner_keys;`.

## 13. Alerts (optional email)

Alerts go to the owner's devices only. You're told when:

- more than 20% of the news sources failed in the morning run,
- the morning edition isn't ready by your wake time, or
- an AI model has used 80% of its free daily allowance (once a day per model).

Each alert is sent at most once a day, as a push notification to your phone and, if set up, an email:

1. Sign up at <https://resend.com> (free plan) and create an API key.
2. Add to `supabase/functions/.env`: `RESEND_API_KEY=re_...` and `ALERT_EMAIL=you@example.com`
   (the email address you signed up to Resend with: without your own domain, Resend only delivers to that address).
3. Re-run step 7.

---

## Moving an existing Brewsy to the free setup

For a Brewsy that already runs on Claude and OpenAI (set up before October 20). The installed app keeps working
through every step. Do it at a quiet time: **not within an hour of your edition** (05:00 IST with a 05:30 wake time).

1. **Get the three free keys** (step 2) and add them to `supabase/functions/.env`, with `TTS_PROVIDER=none`.
2. **Log in again if needed:** `npx supabase login` (an old access token stops working after a while).
3. **Update the database first:** `npx supabase db push`. It adds the `brewsy_readers` migration. Everything in it is
   additive, so the running functions keep working. It marks every device that exists now as the owner's, and records
   that they already had the latest edition's morning push (so nobody gets it twice today).
   Do this **before any friend installs the app**: a friend's device saved before this step would be marked as an owner too.
4. **Upload the secrets:** `npx supabase secrets set --env-file supabase/functions/.env` (step 7).
5. **Deploy the functions:** `npx supabase functions deploy daily-briefing go-deeper ask --use-api`.
6. **Check it** (with the `brewsy` helper from step 10):

   ```bash
   brewsy '{"dryRun":true}'                   # "model": "cloudflare:@cf/openai/gpt-oss-120b", feeds ok
   brewsy '{"dryRun":true,"region":"IN"}'     # India's local feeds
   brewsy '{"stage":"region","region":"IN"}'  # makes today's India section (2 AI calls)
   ```

   After a minute, `select region, date, status, error from regional_editions;` shows `IN … ready`.
   Leave today's world edition as it is: tomorrow's is written on the free setup by itself.
7. **Check the owner mark:** run the first query of step 12. If an old simulator or test device is marked
   `is_owner`, unmark it.
8. **Remove the paid keys** (only now: the old functions needed them until step 5). See what's set with
   `npx supabase secrets list`, then unset the ones you have, for example:

   ```bash
   npx supabase secrets unset ANTHROPIC_API_KEY OPENAI_API_KEY ELEVENLABS_API_KEY GEMINI_API_KEY LLM_PROVIDER CLAUDE_MODEL ASK_DAILY_LIMIT
   ```

   Delete the same lines from `supabase/functions/.env`, then revoke those keys in the Anthropic and OpenAI
   consoles so nothing can bill you.
9. **Ship the app update** (the local section, phone-voice listening, the caps messages) the usual way.
   Old copies of the app keep working: they just don't show the local section.

---

## What happens every day

Example: you (the owner) wake at 05:30 in India; friends read in every region. Times in IST, late October.
Every 10-minute tick does at most one heavy job, and each job runs in its own function call (each gets the full
time limit). Morning pushes are sent first on every tick, for whoever's wake time has passed.

| IST | What happens |
| --- | --- |
| 05:00 | 30 min before your wake time: the world edition is written (2–3 min), dated your local date. |
| 05:10 | The audio scripts (Quick and Full). |
| 05:20 | India's local section (it's past 05:00 in India). |
| 05:30–05:40 | Your morning push: "Your Brewsy edition is ready ☀️ — 12 stories, 7 min", with a **Listen now** button. If the edition isn't ready, you get an alert instead. |
| 09:50 | A "Since this morning" check, 40 min before the UK section. |
| 10:30 | The UK section (05:00 in London; 09:30 IST in British summer time). |
| 11:30–13:30 | Daytime check 1 (6 hours after you wake). |
| 13:50 | A check before the US and Canada sections (one covers both: a second within the hour is skipped). |
| 14:30, 14:40 | The US and Canada sections (05:00 in New York and Toronto; an hour later in winter). |
| 17:30–19:30 | Daytime check 2 (12 hours after you wake; never after 22:00 your time). |
| 22:50 | A check before the Australia section. |
| 23:30 | The Australia section (05:00 in Sydney, dated Sydney's date; 00:30 IST in Sydney's winter). |
| each reader's wake time | Their morning push, for the latest edition ready by their local date. A friend in Sydney wakes before your next edition is written, so they get (and see) the edition from your morning, with the checks added since. |
| if something fails | The edition is retried after 30 min, the audio scripts after 30 min (up to 3 times), a local section after 30 min (up to 3 times). A failed news source is retried once within the same run. |

**Which readers count.** A region gets a local section (and its check) only while one of its readers opened the
app in the last 14 days. A reader's region is what they chose in the app's Settings, or else it's guessed from
their timezone (Asia/Kolkata → India, Canadian zones → Canada, other American zones → US, Europe/London → UK,
Australia/… → Australia, anything else → world news only).

**"Since this morning" checks.** Same sources and scoring as the edition. A story that passes the must-include bar
and isn't in the latest edition is written up and added on top of Today with a **New** badge (max 2 per check).
A quiet check costs no AI calls. If a story is very big (7+ major outlets or a wire "breaking" flag), readers with
breaking pushes on get a push: max 2 per edition, and only while it's 07:00–22:00 where the reader is.

**Settings.** Each reader's wake time, timezone, region, topics and pushes are saved to the `devices` table from the
app's Settings. Your wake time and timezone time the world edition. Topics: the edition always covers all 15, and
the app shows each reader the ones they follow. The starred topics (**More of this**) that shape the edition are
yours, topped up to 4 with the topics your friends star most. Muted outlets and muted words are applied on each
phone, not on the server.

> If you set Brewsy up before October 11, run `npx supabase db push` once more. The first schema only accepted
> 4 topics, so the app's settings saves (wake time, push token, topics) were being refused once a reader
> followed a newer topic. The `brewsy_topics_focus` migration fixes that and adds `focus_topics`.
>
> The Oceans topic (October 21) needs the `brewsy_oceans` migration the same way: run `npx supabase db push`
> before deploying the functions and the app update, or a reader who switches Oceans on stops saving settings.

## The free AI budget

Every AI call is one of seven kinds, and each kind has a route: models tried in order, moving on when one is
busy (HTTP 429), says the request is too big (413), fails (5xx, a timeout, an empty or broken reply), or has
used its free allowance for the day. Brewsy counts calls and tokens per model per day in `ai_usage`
(the day is counted in UTC) and skips a model just before its limit.

| Kind | Route (first choice first) |
| --- | --- |
| `edition` (pick, editor, writing, summary) | Cloudflare gpt-oss-120b → Cloudflare Gemma 4 26B → Groq gpt-oss-120b (prompt cut to fit) |
| `script` (audio), `refresh` (checks), `region-stories` (local stories), `region` (local one-liners), `deeper` (Go deeper) | Groq gpt-oss-120b → Groq Qwen 3.8 27B → Cloudflare |
| `ask` | Groq gpt-oss-120b → Groq gpt-oss-20b → Cloudflare |

The free limits, and what a normal day uses (one edition, five local sections, readers using Ask and Go deeper):

| Model | Free limit a day | Used for | A normal day |
| --- | --- | --- | --- |
| Cloudflare Workers AI `@cf/openai/gpt-oss-120b` | 10,000 neurons, shared by all its models (resets 00:00 UTC) | The world edition; overflow | One edition: 9 calls, ≈ 73,000 tokens in and 15,000 out ≈ 3,500 neurons. A deep dive there ≈ 400 |
| Groq `openai/gpt-oss-120b` | 1,000 requests, 200,000 tokens (8,000 tokens a minute; ≤ 7,000 a request) | Audio scripts, local sections, checks, Go deeper, Ask | Requests are cut to fit; ≈ 25 questions or deep dives' worth of tokens |
| Groq `qwen/qwen3.8-27b` | 1,000 requests, 200,000 tokens | The same, once gpt-oss-120b is busy or used up | ≈ 25 more |
| Groq `openai/gpt-oss-20b` | 1,000 requests, 200,000 tokens | Ask backup | ≈ 25 more questions |

What that means in practice:

- **Cloudflare is kept for the edition.** Only Cloudflare takes an edition's big requests (the pick and editor
  prompts are ~16,000 tokens; Groq's free tier stops at 8,000 tokens a minute), so everything else tries Groq
  first, and the last 4,500 of Cloudflare's daily neurons are kept for the edition (`CLOUDFLARE_EDITION_RESERVE`
  in `llm.ts`).
- One edition a day fits. A forced re-run (`{"force":true}`) the same day spends another ≈ 3,500 neurons; a third
  edition in one UTC day won't fit, and Groq writes it from shortened prompts.
- Go deeper and Ask are capped (below) so readers can't use up the writing models.
- When a model reaches 80% of its day, you get an alert (step 13). When every model of a route is used up, that kind
  of work waits for the next day: Ask and Go deeper say "Today's free AI allowance is used up", and the scheduled
  jobs retry after 30 minutes.
- Groq's 8,000 tokens a minute means about one question a minute per Groq model. Brewsy paces its requests, so a
  burst of questions waits a few seconds or moves on to the next model.

Limits change. Check them at [Groq](https://console.groq.com/docs/rate-limits) and
[Cloudflare](https://developers.cloudflare.com/workers-ai/platform/pricing/) (and the numbers at the top of
`supabase/functions/_shared/llm.ts`).

### Ask and Go deeper caps

Per rolling 24 hours. The app sends its device ID with each request. A request from an unknown or missing device ID
shares one small bucket with all the others like it.

| | Per device | In total (all readers) | Secrets |
| --- | --- | --- | --- |
| Ask | 5 | 60 | `ASK_CAP_DEVICE`, `ASK_CAP_TOTAL` |
| Go deeper | 8 new deep dives (a story someone already opened is free) | 30 | `DEEPER_CAP_DEVICE`, `DEEPER_CAP_TOTAL` |
| No device ID | 10 (Ask and Go deeper each) | | `AI_CAP_NO_DEVICE` |

Over a cap, the app shows "You've used today's questions. They reset tomorrow." (or "…deep dives…").
Change a cap without a redeploy: `npx supabase secrets set ASK_CAP_DEVICE=8`. Every request is counted before
the AI is asked, so failed ones count too.

## How Brewsy decides what's important

Everything is in `supabase/functions/_shared/scoring.ts` (numbers you can tune at the top):

- **Coverage breadth** is the strongest signal: how many different outlets covered the story
  (Yahoo News items count for the outlet that wrote them, e.g. AP or AFP).
- **Source weight:** each source has a trust level (high 1.5, medium 1, low 0.5).
- **Impact:** markets moved, rates or economic data, governments or conflict, many people affected,
  major companies, deals, security breaches, records, big money; official sources get a bonus.
- **Newness:** fresher is better; a follow-up to yesterday's story ranks lower than brand-new news.
- **Must-include rule:** covered by **5+ major outlets** (wires + major newsrooms), or flagged
  "breaking" by a wire service → **always** in the edition, whatever the story limit. The AI is told,
  and the code puts back any it leaves out.
- **Every topic gets covered:** about 12 stories are picked by importance (the followed topics
  get 2–4 each, the big general topics several), then each topic with real news today (2+ outlets, not a deal
  or a review) gets its best story, the followed topics first, up to 18 full stories in all. That's 6 batches
  of 3, written at the same time: with the pick, editor and summary calls, 9 AI calls. The AI is shown the best
  ~160 candidates plus the best 4 of every topic, so small beats always reach it. Those reserved places (and each
  beat's share of the ~280 stories kept after grouping) go to different outlets first: the best story of each
  outlet not yet picked, then the next best (`spreadAcrossOutlets` in `dedupe.ts`). The big outlets' stories rank
  high anyway, so the reserved places bring in a beat's smaller voices instead of more stories from its busiest feed.
- **More of this (starred topics):** your stars, topped up to 4 with your friends' most-starred topics. A starred
  topic gets real depth. Grouping keeps three times its usual share of stories, the AI sees its best 10 candidates
  instead of 4 and is asked for 4–6 stories on it where the news supports it; the story target grows
  by 2 per starred topic (12 → at most 16), and a starred topic with real news always ends up with at least 2 full
  stories. The 18-story cap stays, so it's still 6 writing batches and 9 AI calls: starring topics changes *which*
  stories are written, not how many calls an edition makes. In "Also happening" the editor fills up to 4 lines per
  starred topic and 2 per other followed topic before the rest (at least 2 headline lines if the editor gives a
  starred topic fewer). The daytime check may add one starred-topic story per check that broke after the edition
  and 4+ outlets already cover; it never sends a push. The audio briefing plays starred topics first, like Today.
- **Local news stays local:** the national desks of each region (The Hindu and the Hindustan Times for India, CBC
  and CTV for Canada, the BBC's and the Guardian's UK pages, ABC Australia, NPR's national desk…) only feed that
  region's local section, so the world edition isn't tilted toward one country. A local section is chosen from the
  local feeds plus world feeds' stories that name the region, leaving out anything already in the world edition:
  1–2 full stories and 4–6 one-liners (`region.ts`). Topic beats stay in the world edition wherever they come
  from (cricket, Indian film, Autocar India): readers anywhere follow those topics.
- **Movies** has its own film desks (37 feeds): the Hollywood trades (Variety, Deadline, The Hollywood
  Reporter, IndieWire) and their international desks (Variety Global and Variety's global section, Deadline
  International: Asian, European, Latin American and Middle Eastern film business, box office and festivals);
  world and independent film (Screen Daily, The Playlist, The Film Stage, World of Reel, ScreenAnarchy, and the
  film desks of The Guardian and the South China Morning Post); Indian cinema (Bollywood Hungama, Cinema Express
  for South Indian film, Koimoi for box office, Onmanorama for Malayalam film, and the cinema desks of The Hindu,
  The Indian Express and the Hindustan Times' Tamil and Telugu pages); East and Southeast Asia (City On Fire for
  Hong Kong and Asian action cinema, Rappler for Philippine film); the Middle East and Turkey (The National,
  Daily Sabah); Africa (Afrocritik, Nollycritic for Nollywood, Sinema Focus for East Africa, Bizcommunity for South
  Africa); Europe, Australia and Canada (Cinecittà News for Italy, IF Magazine, Playback); and animation and
  documentary (Cartoon Brew, Animation Magazine, POV Magazine, Business Doc Europe). Only English-language feeds:
  grouping compares English words, so a Spanish or Korean headline would never join its story. Korea, Japan,
  Latin America and most of Europe have no working English film feed of their own (blocked, gone, or mostly K-pop,
  TV and gossip; see the notes at the top of `sources.ts`), so their film news comes through the trades'
  international desks, Screen Daily and the SCMP. TV, music and celebrities stay under Entertainment. Film and
  entertainment feeds skip celebrity-gossip headlines (holiday photos, outfits, "shares first post"; `GOSSIP_PATTERNS` in `feeds.ts`), and
  every feed skips shopping roundups (`JUNK_PATTERNS`); a plain "deal" in a headline is news and is kept.
- **Oceans** has its own ocean desks (10 feeds): The Guardian's oceans and marine life pages; Mongabay's marine
  news and Mongabay India's oceans page (conservation, fisheries, marine protected areas, deep-sea mining, new
  species); Oceanographic Magazine; Inside Climate News' oceans page; Dialogue Earth's ocean desk (Asia's seas and
  distant-water fishing); ScienceDaily's oceanography press releases (counted lightly); and the research institutes
  WHOI and MBARI for ocean science and deep-sea discoveries. When the Guardian or Inside Climate News carry the same
  article in their science or environment feed, it keeps the oceans hint. Oceans is off for new readers until they
  switch it on. Most ocean outlets post a few times a week, so a quiet day may bring one story or only a line.
- **Editor's checklist:** a second AI pass looks at everything that wasn't picked, category by
  category (markets, central banks, economic data, earnings, AI launches, AI policy, deals, politics,
  conflict, disasters, notable deaths, security, science and health, sport, culture). It can add up to
  4 stories and writes the "Also happening" list (up to 15 one-liners, the followed topics first, at least one
  per topic where there's news). A topic left with nothing at all gets its best headline there. If the editor call
  fails, the list falls back to headlines (starred topics first, up to 4 each, then at most two per topic), and the
  reason is logged in `pipeline_runs.stats.editorError`.
- Every fact comes from the articles; source links come from the feeds, never from the AI. Stories still
  unfolding are labelled **Developing**. The app's "How this briefing was made" uses the `coverage` numbers
  saved with each edition.

## Editing the news sources

The list lives in `supabase/functions/_shared/sources.ts`, grouped by category. Each line is one source:

```ts
{ id: 'verge', outlet: 'The Verge', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium',
  url: 'https://www.theverge.com/rss/index.xml' },
```

- `outlet`: the name shown in the app (and the Settings → Sources switch).
- `kind`: `'rss'` for a normal RSS/Atom feed; `'news-sitemap'` for Reuters (no public RSS; headlines
  only); `'aggregator'` for Yahoo News (each item credited to its real outlet); `'html-list'` only for
  Anthropic's news page; `'sec-8k'` for SEC filings. Google News and Bing News don't work from
  Supabase: they refuse cloud servers (HTTP 503), so don't add them.
- `category`: `'wire' | 'major' | 'tech' | 'specialist' | 'official' | 'safety-net'`. Wires and majors count
  toward the must-include rule; `specialist` is the press for one beat (Electrek, IGN, ESPNcricinfo,
  Variety, Bollywood Hungama, CoinDesk, STAT…). A newsroom's own section feed keeps the newsroom's category
  (The Hindu's cinema desk is still `major`).
- `trust`: `'high' | 'medium' | 'low'`.
- `topicHint`: one of the 15 topics (`'ai'`, `'tech'`, `'business'`, `'world'`, `'politics'`, `'science'`,
  `'health'`, `'climate'`, `'oceans'`, `'autos'`, `'gaming'`, `'sports'`, `'entertainment'`, `'movies'`, `'crypto'`) or `'mixed'`.
  It's a nudge (the AI decides per story), and it keeps each beat's best candidates in front of the AI. When the
  same article comes through two feeds of one outlet (Variety and Variety Film, or the Guardian's environment and
  oceans feeds), the narrower hint wins.
- `region` (local feeds only): `'IN' | 'US' | 'UK' | 'CA' | 'AU'`. The feed then only feeds that region's local
  section, and Settings → Sources lists it only for that region's readers. Leave it out for everything else.

After editing:

```bash
npx supabase functions deploy daily-briefing --use-api
```

Then run the health check from step 10 (with `"region"` for a local feed) to confirm the new feed answers. The app
reads the same file for its Sources switches, so restart Expo too.

## Changing the AI

The routes above are the defaults. The `LLM_ROUTES` secret (JSON) replaces the route of any kind, no redeploy needed.
Each step is `"provider"` or `"provider:model"`; providers are `sambanova`, `groq`, `cloudflare`, `openrouter`,
`mistral`, `anthropic` (Claude) and `gemini`.

```bash
# Go deeper on Cloudflare first, then Groq:
npx supabase secrets set LLM_ROUTES='{"deeper":["cloudflare","groq:openai/gpt-oss-120b"]}'
# Back to the defaults:
npx supabase secrets unset LLM_ROUTES
```

A provider without its key is skipped. Claude, Gemini and Mistral are never used unless `LLM_ROUTES` names them:
Claude costs money (it needs `ANTHROPIC_API_KEY`, and `CLAUDE_MODEL` picks the model), Gemini's free tier isn't
offered in the UK and EEA and Google may use free-tier text to improve its products, and Mistral's free API isn't
available. Ask never goes to Gemini or Mistral, whatever `LLM_ROUTES` says, because readers type their own words
there. `OPENROUTER_API_KEY` adds OpenRouter's free models (50 requests a day) if you name them in a route.

## Checking how the runs went

Every edition, audio, local section, update and push run writes one row to `pipeline_runs`. In the SQL Editor:

```sql
select created_at, date, stage, ok, ms, feeds_ok, feeds_total, feeds_failed, error
from pipeline_runs order by created_at desc limit 20;

-- Details of the last edition (stories, must-includes, editor additions, starred topics, target, per-topic counts, model…)
select stats from pipeline_runs where stage = 'edition' order by created_at desc limit 1;

-- Today's local sections
select region, date, status, attempts, generated_at, error from regional_editions order by date desc, region limit 10;

-- AI use per model today (UTC), against the free limits above
select provider, model, calls, tokens_in, tokens_out from ai_usage where day = (now() at time zone 'utc')::date order by calls desc;

-- The "Since this morning" checks that ran (one row per slot)
select date, slot, status, started_at, finished_at, error from schedule_runs order by started_at desc limit 10;

-- Ask and Go deeper in the last 24 hours, per device
select device_id, kind, count(*), count(*) filter (where ok) as ok
from ai_requests where created_at > now() - interval '24 hours' group by 1, 2 order by 3 desc;

-- Readers: who's active, where, and when their last morning push went out
select device_id, is_owner, region, timezone, wake_time, morning_push, breaking_push, morning_pushed_on, updated_at
from devices order by updated_at desc limit 20;

-- Alerts sent
select * from alerts order by created_at desc limit 10;
```

---

## Testing

### Listening

1. Make sure today's scripts exist: in **Table Editor → briefings**, `audio_status = ready`
   (or run `brewsy '{"stage":"audio"}'` and wait 2 minutes). `audio_error` says why if it's `error`.
2. In the app, tap **▶ Listen** on Today. With no voice service the phone reads the briefing: the intro, the
   reader's own topics (starred first), their local section, then the sign-off.

### Local sections

1. `brewsy '{"dryRun":true,"region":"UK"}'` shows the UK's local feeds and top stories (no AI).
2. `brewsy '{"stage":"region","region":"UK"}'` makes today's UK section (if it isn't made yet; add `"force":true`
   to redo it). After a minute, `regional_editions` has a `UK` row with `status = ready`.
3. In the app, set the region to United Kingdom in Settings: the local section shows on Today.

### Breaking updates

1. `brewsy '{"stage":"update","force":true}'` runs a check right away. The reply (or the last
   `pipeline_runs` row with `stage = 'update'`) lists the `candidates` it found, what it `added`, and the `push` result.
   On a quiet day it's normal that nothing is new.
2. Anything added shows on Today under "Since this morning" with a **New** badge.
3. A breaking push only goes out for very big stories, so to see what one looks like, send a test
   from <https://expo.dev/notifications> to your device's push token (`devices.push_token`) with
   data `{"kind":"breaking","date":"YYYY-MM-DD","storyId":"…"}`.
4. Turning breaking news off in Settings → **Breaking news** stops them (the server reads `devices.breaking_push`).
   Readers whose local time is outside 07:00–22:00 are skipped.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| curl says `{"error":"Unauthorized."}` (401) | The `x-brewsy-secret` doesn't match. Re-run step 7 (upload secrets) and make sure step 9 used the same value. |
| `briefings.error` says `No AI provider is set up for "edition"` | Step 4/7: the key lines are empty or the secrets weren't uploaded. The message names the keys it looked for. |
| `briefings.error` says `Every AI provider for "edition" is at its free-tier daily limit` | The day's free allowance is used, usually by forced re-runs. Brewsy's counts start over at 00:00 UTC (05:30 IST); the timer retries by itself. The `ai_usage` query shows what was used. |
| `briefings.error` says `No AI provider could answer` | Every model in the route failed. The message lists each one's reason: `HTTP 401` = that key is wrong (make a new one, update the `.env`, re-run step 7); `HTTP 429` = busy, retried in 30 min; `request too large` = see below. |
| `SambaNova … HTTP 402` / `PAYMENT_METHOD_REQUIRED` | Only if you named SambaNova in `LLM_ROUTES`. SambaNova won't serve the key without a card on file, whatever its docs say (Brewsy's key got this on October 20). **Don't add a card**: that's the paid tier. Brewsy skips SambaNova for the run and carries on with Groq and Cloudflare (see [The free AI budget](#the-free-ai-budget)). The function logs show `llm_provider_refused`, and `pipeline_runs.stats.model` shows which model wrote the edition. Test the key by hand: `curl -s https://api.sambanova.ai/v1/chat/completions -H "Authorization: Bearer $SAMBANOVA_API_KEY" -H 'Content-Type: application/json' -d '{"model":"Meta-Llama-3.3-70B-Instruct","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5}'` |
| `… HTTP 402` (other providers) | The provider says the free usage is used up. That provider is skipped for the rest of the run. |
| `Cloudflare … HTTP 401` / `403` | The token lacks `Workers AI - Read` and `Edit`, or `CLOUDFLARE_ACCOUNT_ID` is wrong. Redo step 2. |
| `request too large for its free tier` | A prompt didn't fit a model's free request size; the next model was tried. Harmless unless every model says it. |
| `briefings.error` says `Only N candidate stories came in from the feeds` | The feeds are down or your network is blocked. Run the health check and look at `feeds.failed`. |
| `briefings.error` says `The AI's edition failed validation` | The AI's replies were incomplete. Run the `force` curl again. |
| `audio_status = error` | `audio_error` says why (usually the AI, see above). It's retried after 30 min, up to 3 times. |
| No local section in the app | `regional_editions` has no `ready` row for that region and date: before 05:00 there, no reader of that region opened the app in 14 days, or it failed (`error`, retried up to 3 times). Make it by hand: `brewsy '{"stage":"region","region":"CA","force":true}'`. |
| A friend gets no morning push | Their `devices` row: `morning_push` on, a `push_token`, the right `timezone` and `wake_time`. `morning_pushed_on` is the last local date they got one. |
| Alerts go to the wrong phone, or nobody's | Step 12: check which devices have `is_owner`. |
| SEC filings never show up | Set `SEC_CONTACT_EMAIL` (step 4) and re-run step 7. The health check lists it under `skipped` until then. |
| No edition in the morning | SQL Editor: `select * from cron.job_run_details order by start_time desc limit 5;` (did the timer run?) and `select status_code, content, error_msg from net._http_response order by created desc limit 5;` (what did the function say?). An empty `private.config` means the timer is skipping. Redo step 9. |
| App still shows the sample edition | Check the two `.env` lines in the project root, then `npx expo start -c`. |
| Wake time, topics or region changed in the app but the server ignores them | The `devices` row isn't updating. Run `npx supabase db push` (the latest migrations let the table accept all 15 topics, `focus_topics` and `region`), then change any setting in the app to send it again. Check with the readers query under "Checking how the runs went". |
| "Go deeper" / "Ask" say "Story not found" | The app is showing the built-in sample. These only work on real editions. |
| "You've used today's questions" / "…deep dives" | A cap was reached (see [Ask and Go deeper caps](#ask-and-go-deeper-caps)); it's a rolling 24 hours. |
| "Today's free AI allowance is used up" | Every model for Ask or Go deeper is at its daily limit. It works again the next day. |
| `functions deploy` complains about Docker | Add `--use-api` (step 8). |
| `Claude HTTP …` / `Gemini HTTP …` | Only if `LLM_ROUTES` names them: check that provider's key, or unset `LLM_ROUTES`. |
| Want to see logs | Dashboard → **Edge Functions** → pick a function → **Logs**, or the `pipeline_runs` table. |

**Regenerate today's edition:** `brewsy '{"force":true}'` again. It replaces today's edition and starts its
audio and the day's updates over. If the rewrite fails, the previous edition stays up. It costs about 10 calls of
DeepSeek-V3.1's 20 a day.

**Change the CRON_SECRET:** edit `supabase/functions/.env`, re-run step 7, then re-run the step 9 SQL with the new value.

**Pause the timer / resume it:**

```sql
select cron.unschedule('brewsy-tick');   -- pause
```

To resume, run the `select cron.schedule(...)` block from `supabase/migrations/20261007000100_brewsy_cron.sql` in the SQL Editor.

---

## For developers

What the app calls (all over HTTPS to `EXPO_PUBLIC_SUPABASE_URL`, header `apikey: <publishable key>`):

| Call | Request |
| --- | --- |
| An edition | `GET /rest/v1/briefings?select=data,audio,updates&date=eq.YYYY-MM-DD&status=eq.ready` → the app shows `{...data, audio, sinceThisMorning: updates}` |
| Edition dates | `GET /rest/v1/briefings?select=date&status=eq.ready&order=date.desc&limit=30` |
| A local section | `GET /rest/v1/regional_editions?date=eq.YYYY-MM-DD&region=eq.CA&status=eq.ready&select=data` → `RegionalEdition` (`types.ts`); none → no local section |
| Save settings | `POST /rest/v1/devices?on_conflict=device_id` + headers `x-device-id: <device_id>`, `Prefer: resolution=merge-duplicates,return=minimal`, `Content-Type: application/json`; body `{device_id, push_token, platform, timezone, wake_time, topics, focus_topics, disabled_sources, morning_push, breaking_push, region}` |
| Go deeper | `POST /functions/v1/go-deeper` + header `x-device-id`, `{"date","storyId"}` → `{"deepDive","cached"}` (main, "Also happening", update and local stories). Over the cap: 429 `{"error"}` |
| Ask | `POST /functions/v1/ask` + header `x-device-id`, `{"date","storyId","question"}` → `{"answer","answeredFromSources"}`. Over the cap: 429 `{"error"}` |
| Audio | `briefings.audio`: each chapter has `lead` (the spoken lead-in) and `body`; `script` = both, for older apps. `url`s only exist with a voice service |

Push notification `data` (see `src/lib/notifications.ts`): morning `{kind:'edition', date}` with category
`edition` ("Listen now" action `listen`); breaking `{kind:'breaking', date, storyId}`; alerts `{kind:'alert'}`.

A device can only create, change or read **its own** `devices` row. The row's `device_id` must equal the
`x-device-id` header, and the app can't set `is_owner` or `morning_pushed_on`. Editions, local sections, audio and
deep dives are read-only to the app. Article text (`story_context`), the Ask log, `ai_usage`, `ai_requests`,
`schedule_runs`, `pipeline_runs`, `alerts` and `private.config` are server-only. Local story IDs start with the
region (`ca-…`), which is how Go deeper and Ask find them.

Where things live in `supabase/functions/_shared/`: `sources.ts` (source list), `feeds.ts` (fetching and
parsing), `dedupe.ts` (grouping), `scoring.ts` (importance), `pipeline.ts` (the edition), `region.ts` (local
sections), `updates.ts` (daytime checks), `audio.ts` + `audio-config.ts` + `tts.ts` + `mp3.ts` + `storage.ts` (audio),
`llm.ts` (the AI providers, routes and free-tier budgets), `caps.ts` (Ask and Go deeper caps), `prompts.ts`,
`validate.ts`, `prefs.ts` (readers, regions and the tick planner), `store.ts`, `push.ts`.

Run the backend tests (143 tests, no keys needed):

```bash
npx --yes deno@latest test -A --node-modules-dir=none --no-lock supabase/functions/_tests/
```

Try the feed pipeline against live feeds, without AI or a database (feed health, grouping time, top stories with scores):

```bash
npx --yes deno@latest run -A --node-modules-dir=none --no-lock supabase/functions/daily-briefing/dev.ts --articles
npx --yes deno@latest run -A --node-modules-dir=none --no-lock supabase/functions/daily-briefing/dev.ts --region CA
```
