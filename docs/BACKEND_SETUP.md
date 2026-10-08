# Brewsy backend setup

This puts Brewsy's "newsroom" online so a fresh edition, with an audio version, is waiting for you every morning.

```
every 10 min   Supabase timer (pg_cron) ──► daily-briefing function: does the next thing that's due
                 ~30 min before wake   EDITION  reads ~47 sources (~700 articles), groups them into stories,
                                                scores importance, Claude picks + writes ~10–16 stories,
                                                a second "editor" pass checks for misses, "Also happening"
                 right after           AUDIO    radio scripts (Quick ≈ 3 min, Full ≈ 10 min) → voice → MP3s
                 at wake time          PUSH     "Your Brewsy edition is ready" (with a Listen now button)
                 7am–10pm, every 2 h   UPDATE   new major stories → "Since this morning" (+ max 2 breaking pushes)
in the app     Today tab ──► reads the edition + audio + updates     "Go deeper" / "Ask" ──► go-deeper / ask
```

Setup takes about 30 minutes. You type commands in a terminal, in the Brewsy project folder:

```bash
cd ~/Documents/brewsy
```

> **Keep secrets out of screenshots and chats.** Your AI and voice keys, your `CRON_SECRET`
> and your Supabase *secret* key should never be shared or committed. The Supabase
> *publishable* key is fine to put in the app.

## What it costs per month

| Service | What for | Cost |
| --- | --- | --- |
| Supabase (free plan) | Database, functions, timer, audio storage (≈ 25 MB a day; 7 days kept) | $0 |
| Anthropic API, Claude Opus 5.5 (default) | Writing the edition, editor check, audio scripts, daytime updates | ≈ $30–35 (≈ 100k input + 35k output tokens a day at $4 / $20 per million) |
|  ↳ or Claude Sonnet 5.5 (`CLAUDE_MODEL=claude-sonnet-5-5`) | same | ≈ $15–20 ($2 / $10 per million) |
|  ↳ or Google Gemini free tier (no Anthropic key) | same | $0 (rate-limited; Google may use the text to improve its products) |
| "Go deeper" / "Ask" | On demand | ≈ $0.03–0.05 per use on Opus 5.5 |
| OpenAI text-to-speech, `gpt-4o-mini-tts` (default voice) | ≈ 13 min of audio a day | ≈ $6 |
|  ↳ or ElevenLabs | more lifelike voices | ≈ $18–35 (see `audio-config.ts`) |
|  ↳ or no voice service (`TTS_PROVIDER=none`) | the phone reads the script aloud | $0 |
| Resend (optional) | Alert emails | $0 (free plan) |
| Expo push notifications | Morning + breaking pushes | $0 |

**Typical total: ≈ $36–41 a month** with Opus + OpenAI voice, ≈ $21–26 with Sonnet, $0 with Gemini and the phone's voice.
Prices change: check [claude.com/pricing](https://claude.com/pricing), [openai.com/api/pricing](https://openai.com/api/pricing) and [elevenlabs.io/pricing](https://elevenlabs.io/pricing).
Set a monthly spend limit in each console so a bug can never run up a bill.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up, and click **New project**.
2. Name: `brewsy`. Database password: click **Generate** and save it in a password manager.
   Region: **South Asia (Mumbai)** (closest to India).
3. Wait about two minutes for it to finish.
4. Find your **project ref**. It's the code in the dashboard address:
   `supabase.com/dashboard/project/`**`abcdefghijklmnop`**. You'll use it below wherever you see `YOUR-PROJECT-REF`.

## 2. Get an AI key

**Claude (recommended):**

1. Go to <https://platform.claude.com>, sign up, and add a payment method under **Billing**
   (set a monthly limit there too, e.g. $50).
2. **API keys → Create key**, copy it (it starts with `sk-ant-`).

**Or Gemini (free):** <https://aistudio.google.com/apikey> → **Create API key**. Brewsy uses Gemini
only when there's no Anthropic key (or when you set `LLM_PROVIDER=gemini`).

## 3. Get a voice key (for the audio briefing)

Pick one. Which one is used is set in `supabase/functions/_shared/audio-config.ts` (`PROVIDER`), or
with the `TTS_PROVIDER` secret (`openai`, `elevenlabs` or `none`) without a redeploy. The file explains the costs.

- **OpenAI (default, ≈ $6/month):** <https://platform.openai.com/api-keys> → **Create new secret key**.
  Add a few dollars of credit under **Billing**.
- **ElevenLabs (most lifelike):** <https://elevenlabs.io> → **Developers → API keys**. Set `TTS_PROVIDER=elevenlabs`.
  To change the voice, copy a voice ID from the Voice Library into `ELEVENLABS_VOICE_ID`.
- **None:** set `TTS_PROVIDER=none`. The app reads the same radio-style script aloud with the phone's voice.

If the voice service fails on a day, the app still plays the briefing with the phone's voice, and the
server tries the voice again 30 minutes later (up to 3 times).

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
ANTHROPIC_API_KEY=sk-ant-...          (or GEMINI_API_KEY=...)
OPENAI_API_KEY=sk-...                 (or ELEVENLABS_API_KEY=... and TTS_PROVIDER=elevenlabs)
CRON_SECRET=paste-the-random-string
```

Delete any line you leave empty. Optional lines (explained in the file):

- `SEC_CONTACT_EMAIL`: turns on SEC 8-K filings (Apple, Nvidia, Tesla…). The SEC requires a contact
  email in every request; without it that source is skipped, which is fine.
- `RESEND_API_KEY` + `ALERT_EMAIL`: emails you when something goes wrong (step 11). Without them,
  alerts still arrive as a push notification.

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

It lists the migrations (`brewsy_schema`, `brewsy_cron`, `brewsy_listen_coverage`) and asks you to confirm. Type `Y`.
This creates the tables with their security rules, a public `audio` storage bucket for the MP3s,
the run log (`pipeline_runs`) and `alerts` tables, turns on `pg_cron` and `pg_net`, and schedules a job
called `brewsy-tick` every 10 minutes. The job does nothing until step 9.

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
```

The reply shows how many feeds answered (`feeds.ok` / `feeds.total`, and which failed), how many
articles and outlets came in, how many distinct stories they grouped into, and the top 25 stories with
their importance `score`, `breadth` (outlets), `majorOutlets`, `mustInclude` and the reasons (`why`).

**Write today's edition:**

```bash
brewsy '{"force":true}'
```

You should see `{"action":"generate",…,"status":"started"}`. Writing takes 1–2 minutes. Then, in the
dashboard, open **Table Editor → briefings**. Today's row should say `status = ready`. A few minutes
later `audio_status` turns `ready` too (the edition starts the audio run by itself).

**Other things you can trigger by hand:**

```bash
brewsy '{"stage":"audio"}'                  # make today's audio (if it isn't made yet)
brewsy '{"stage":"audio","force":true}'     # make it again (e.g. after changing the voice)
brewsy '{"stage":"update","force":true}'    # run a "Since this morning" check now, any time of day
```

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

## 12. Alerts (optional email)

You're told when:

- more than 20% of the news sources failed in the morning run, or
- the morning edition isn't ready by your wake time.

Each alert is sent at most once a day, as a push notification to your phone and, if set up, an email:

1. Sign up at <https://resend.com> (free plan) and create an API key.
2. Add to `supabase/functions/.env`: `RESEND_API_KEY=re_...` and `ALERT_EMAIL=you@example.com`
   (the email address you signed up to Resend with: without your own domain, Resend only delivers to that address).
3. Re-run step 7.

---

## What happens every day

Example: wake time 05:30, timezone Asia/Kolkata (the defaults). Every 10-minute tick does at most one
heavy job, and each job runs in its own function call (each gets the full time limit).

| Time (your timezone) | What happens |
| --- | --- |
| 05:00 | 30 min before wake time: the edition is written (1–2 min). Right after, the audio run starts (1–2 min). |
| 05:30–05:40 | The first tick after wake time sends one push: "Your Brewsy edition is ready ☀️ — 12 stories, 7 min", with a **Listen now** button. If the edition isn't ready, you get an alert instead. |
| 07:00, 09:00 … 21:00 | "Since this morning" check: same sources and scoring. A story that passes the must-include bar and isn't in today's edition is written up and added on top of Today with a **New** badge (max 2 per check). If it's very big (7+ major outlets or a wire "breaking" flag) and you have breaking pushes on, you get a push: max 2 a day, never between 10pm and 7am. |
| if something fails | The edition is retried after 30 min. Audio is retried after 30 min, up to 3 times (the phone's voice covers meanwhile). A failed news source is retried once within the same run. |

**Changing the wake time, topics, sources or breaking pushes:** do it in the app's Settings. The app saves
them to the `devices` table, and the server uses the device whose settings changed most recently. Topics
are the exception: the edition always covers all 13, and the app shows each reader the ones they follow
(so switching a topic on shows today's stories for it straight away).

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
- **Every topic gets covered:** about 12 stories are picked by importance (the topics the reader follows
  get 2–4 each, the big general topics several), then each other topic with real news today (2+ outlets, not a deal or a review) gets its
  best story, up to 18 full stories in all. That's 6 batches of 3, written at the same time: with the
  pick, editor and summary calls, 9 AI calls, what two Gemini free-tier models allow in a minute.
  The AI is shown the best ~160 candidates plus the best 4 of every topic, so small beats always reach it.
- **Daily AI budget:** the Gemini free tier also caps each model at **20 requests a day** (40 with the
  fallback model). An edition uses 9 (11 if the editor adds stories), its audio 2, and the daytime
  "Since this morning" checks up to 8, which leaves about 20 for Go deeper and Ask. Every forced re-run
  spends another 11; when the day's requests are used up, AI calls fail with HTTP 429 until the quota resets.
- **Editor's checklist:** a second AI pass looks at everything that wasn't picked, category by
  category (markets, central banks, economic data, earnings, AI launches, AI policy, deals, politics,
  conflict, disasters, notable deaths, security, science and health, sport, culture). It can add up to
  4 stories and writes the "Also happening" list (up to 15 one-liners, at least one per topic where
  there's news; Gemini rejects the schema at 30). A topic left with nothing at all gets its best
  headline there. If the editor call fails, the list falls back to headlines, at most two per topic, and
  the reason is logged in `pipeline_runs.stats.editorError`.
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
  Variety, CoinDesk, STAT…).
- `trust`: `'high' | 'medium' | 'low'`.
- `topicHint`: one of the 13 topics (`'ai'`, `'tech'`, `'business'`, `'world'`, `'politics'`, `'science'`,
  `'health'`, `'climate'`, `'autos'`, `'gaming'`, `'sports'`, `'entertainment'`, `'crypto'`) or `'mixed'`.
  It's a nudge (the AI decides per story), and it keeps each beat's best candidates in front of the AI.

After editing:

```bash
npx supabase functions deploy daily-briefing --use-api
```

Then run the health check from step 10 to confirm the new feed answers. The app reads the
same file for its Sources switches, so restart Expo too.

## Changing the AI model

Claude Opus 5.5 is the default when `ANTHROPIC_API_KEY` is set. No redeploy needed for any of these:

```bash
npx supabase secrets set CLAUDE_MODEL=claude-sonnet-5-5    # cheaper, still very good
npx supabase secrets set LLM_PROVIDER=gemini               # use Gemini even with a Claude key
npx supabase secrets set GEMINI_MODEL=gemini-flash-latest  # another Gemini model
```

## Checking how the runs went

Every edition, audio, update and push run writes one row to `pipeline_runs`. In the SQL Editor:

```sql
select created_at, date, stage, ok, ms, feeds_ok, feeds_total, feeds_failed, error
from pipeline_runs order by created_at desc limit 20;

-- Details of the last edition (stories, must-includes, editor additions, model…)
select stats from pipeline_runs where stage = 'edition' order by created_at desc limit 1;

-- Alerts sent
select * from alerts order by created_at desc limit 10;
```

---

## Testing

### The audio, with the screen locked

Needs a development build on a real phone (lock-screen controls don't exist in a simulator or Expo Go).

1. Make sure today's audio exists: in **Table Editor → briefings**, `audio_status = ready`
   (or run `brewsy '{"stage":"audio"}'` and wait 2 minutes). `audio_error` says why if it's `error`.
2. In the app, tap **▶ Listen** on Today and pick Quick or Full. Tap the mini player: the sheet
   should offer **Download for offline** (if it says "Read by your phone's voice", there's no MP3 yet). Lock the phone.
3. Audio keeps playing. The lock screen shows the story title with play/pause and ⟲10 / 10⟳:
   in Brewsy those two jump to the previous / next story. Headphone and car play/pause work too
   (their next/previous buttons don't skip stories). Unlock: the story being read is highlighted on Today.
4. To test the phone-voice fallback: `npx supabase secrets set TTS_PROVIDER=none`, then
   `brewsy '{"stage":"audio","force":true}'`. Set it back afterwards (`TTS_PROVIDER=openai`) and run it again.

### Breaking updates

1. `brewsy '{"stage":"update","force":true}'` runs a check right away. The reply (or the last
   `pipeline_runs` row with `stage = 'update'`) lists the `candidates` it found, what it `added`, and the `push` result.
   On a quiet day it's normal that nothing is new.
2. Anything added shows on Today under "Since this morning" with a **New** badge.
3. A breaking push only goes out for very big stories, so to see what one looks like, send a test
   from <https://expo.dev/notifications> to your device's push token (`devices.push_token`) with
   data `{"kind":"breaking","date":"YYYY-MM-DD","storyId":"…"}`.
4. Turning breaking news off in Settings → **Breaking news** stops them (the server reads `devices.breaking_push`).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| curl says `{"error":"Unauthorized."}` (401) | The `x-brewsy-secret` doesn't match. Re-run step 7 (upload secrets) and make sure step 9 used the same value. |
| `briefings.error` says `ANTHROPIC_API_KEY is not set` / `GEMINI_API_KEY is not set` | Step 4/7: the key line is empty or the secrets weren't uploaded. |
| `briefings.error` says `Claude HTTP 401` | The Anthropic key is wrong or revoked. Make a new one, update the `.env`, re-run step 7. |
| `briefings.error` says `Claude HTTP 429` / `rate limit` | Too many requests for your account's tier, or the spend limit was reached (check Billing). The timer retries after 30 min. |
| `briefings.error` says `Claude HTTP 404` | The model isn't available to your key. Try `CLAUDE_MODEL=claude-sonnet-5-5`. |
| `briefings.error` says `Gemini HTTP 429` | Gemini free-tier rate limit. Wait a minute; the timer retries by itself after 30 min. |
| `briefings.error` says `Only N candidate stories came in from the feeds` | The feeds are down or your network is blocked. Run the health check and look at `feeds.failed`. |
| `briefings.error` says `The AI's edition failed validation` | The AI's replies were incomplete. Run the `force` curl again. |
| `audio_status = error`, `audio_error` says `HTTP 401` | Voice key wrong: fix it in the `.env`, re-run step 7, then `brewsy '{"stage":"audio","force":true}'`. |
| `audio_error` says `HTTP 429` or `insufficient_quota` | Add credit to the voice account (OpenAI Billing / ElevenLabs plan). |
| `audio_error` says `Storage upload … failed (404)` | The `audio` bucket is missing: run `npx supabase db push` (step 6). |
| Listen plays the phone's voice, not the real voice | That day's audio is text-only: no voice key is set (the health check shows `"tts": "none"`), `TTS_PROVIDER=none`, or the voice failed (see `audio_error`). |
| SEC filings never show up | Set `SEC_CONTACT_EMAIL` (step 4) and re-run step 7. The health check lists it under `skipped` until then. |
| No edition in the morning | SQL Editor: `select * from cron.job_run_details order by start_time desc limit 5;` (did the timer run?) and `select status_code, content, error_msg from net._http_response order by created desc limit 5;` (what did the function say?). An empty `private.config` means the timer is skipping. Redo step 9. |
| App still shows the sample edition | Check the two `.env` lines in the project root, then `npx expo start -c`. |
| "Go deeper" / "Ask" say "Story not found" | The app is showing the built-in sample. These only work on real editions. |
| "That's the daily limit of 100 questions" | The Ask cap resets on a rolling 24 hours. |
| `functions deploy` complains about Docker | Add `--use-api` (step 8). |
| Want to see logs | Dashboard → **Edge Functions** → pick a function → **Logs**, or the `pipeline_runs` table. |

**Regenerate today's edition:** `brewsy '{"force":true}'` again. It replaces today's edition and starts its
audio and the day's updates over. If the rewrite fails, the previous edition stays up.

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
| Save settings | `POST /rest/v1/devices?on_conflict=device_id` + headers `x-device-id: <device_id>`, `Prefer: resolution=merge-duplicates,return=minimal`, `Content-Type: application/json` |
| Go deeper | `POST /functions/v1/go-deeper` `{"date","storyId"}` → `{"deepDive","cached"}` (works for main, "Also happening" and update stories) |
| Ask | `POST /functions/v1/ask` `{"date","storyId","question"}` → `{"answer","answeredFromSources"}` |
| Audio files | Public URLs in `audio.quick/full.url` and each chapter's `url` (`/storage/v1/object/public/audio/<date>/<mode>-<stamp>/…`) |

Push notification `data` (see `src/lib/notifications.ts`): morning `{kind:'edition', date}` with category
`edition` ("Listen now" action `listen`); breaking `{kind:'breaking', date, storyId}`; alerts `{kind:'alert'}`.

A device can only create, change or read **its own** `devices` row. The row's `device_id` must equal the
`x-device-id` header. Editions, audio and deep dives are read-only to the app. Article text (`story_context`),
the Ask log, `pipeline_runs`, `alerts` and `private.config` are server-only.

Where things live in `supabase/functions/_shared/`: `sources.ts` (source list), `feeds.ts` (fetching and
parsing), `dedupe.ts` (grouping), `scoring.ts` (importance), `pipeline.ts` (the edition), `updates.ts`
(daytime checks), `audio.ts` + `audio-config.ts` + `tts.ts` + `mp3.ts` + `storage.ts` (audio),
`llm.ts` (Claude/Gemini), `prompts.ts`, `validate.ts`, `prefs.ts` (the tick schedule), `store.ts`, `push.ts`.

Run the backend tests (96 tests, no keys needed):

```bash
npx --yes deno@latest test -A --node-modules-dir=none --no-lock supabase/functions/_tests/
```

Try the feed pipeline against live feeds, without AI or a database (feed health, grouping time, top stories with scores):

```bash
npx --yes deno@latest run -A --node-modules-dir=none --no-lock supabase/functions/daily-briefing/dev.ts --articles
```
