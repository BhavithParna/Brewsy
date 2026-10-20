-- Brewsy: the owner plus friends, at $0.
--
-- Additions only: the installed app keeps saving its device row and reading `briefings`
-- exactly as before, so every new column is nullable or has a default.
--
-- devices gets:
--   region            'IN' | 'CA' | 'US' | 'UK' | 'AU' | 'WORLD', written by the app; null =
--                     the server infers it from the timezone
--   is_owner          the owner's devices: they time the world edition and get the alerts.
--                     The app can't write it. Every device that exists today is the owner's.
--   morning_pushed_on the reader's local date of their last morning push (server only)
--   and `updated_at` now means "last saved by the app": server-side changes (morning push
--   stamps, cleared push tokens) no longer move it, so it tells who is still reading.
-- New tables:
--   regional_editions  one local section per (date, region); the app reads ready rows
--   ai_usage           AI calls and tokens per day, provider and model (free-tier budgets)
--   ai_requests        one row per Ask / Go deeper request (the daily caps)
--   schedule_runs      one row per scheduled job slot (a lock: each slot runs once)
-- New server-only functions: ai_usage_add, claim_due_morning_pushes, breaking_push_tokens.

-- ─── devices ────────────────────────────────────────────────────────────────
alter table public.devices
  add column if not exists region            text check (region is null or region in ('IN', 'CA', 'US', 'UK', 'AU', 'WORLD')),
  add column if not exists is_owner          boolean not null default false,
  add column if not exists morning_pushed_on date;

-- The app sends `region` in its upsert. is_owner and morning_pushed_on stay server-only.
grant insert (region), update (region) on public.devices to anon, authenticated;

-- Every device saved before today is the owner's (Brewsy had one reader). Only when no
-- device is marked yet, so running this again can never make a friend an owner.
update public.devices set is_owner = true
where not exists (select 1 from public.devices where is_owner);

-- The old functions sent each edition's morning push once, to every device (briefings.pushed_at).
-- Start existing devices from there, so nobody gets the same morning push twice on the day this ships.
update public.devices d set morning_pushed_on = p.date
from (select max(date) as date from public.briefings where pushed_at is not null) p
where d.morning_pushed_on is null and p.date is not null;

-- `updated_at` = when the app last saved the row (every launch does). Changes made by the
-- functions or the dashboard keep the old value.
create or replace function public.brewsy_touch_device_seen() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or current_user in ('anon', 'authenticated') then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.brewsy_touch_device_seen() from public, anon, authenticated;

drop trigger if exists devices_touch on public.devices;
create trigger devices_touch before insert or update on public.devices
  for each row execute function public.brewsy_touch_device_seen();

-- ─── regional_editions: the local section, one per region per local date ────
create table if not exists public.regional_editions (
  date          date not null,
  region        text not null check (region in ('IN', 'CA', 'US', 'UK', 'AU')),
  status        text not null default 'generating' check (status in ('generating', 'ready', 'error')),
  data          jsonb,
  started_at    timestamptz,
  generated_at  timestamptz,
  error         text,
  attempts      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (date, region),
  constraint regional_editions_ready_has_data check (status <> 'ready' or data is not null)
);

drop trigger if exists regional_editions_touch on public.regional_editions;
create trigger regional_editions_touch before update on public.regional_editions
  for each row execute function public.brewsy_touch_updated_at();

revoke all on public.regional_editions from anon, authenticated;
grant all on public.regional_editions to service_role;
grant select (date, region, status, data, generated_at) on public.regional_editions to anon, authenticated;

alter table public.regional_editions enable row level security;
drop policy if exists "anyone can read ready regional sections" on public.regional_editions;
create policy "anyone can read ready regional sections"
  on public.regional_editions for select to anon, authenticated
  using (status = 'ready');

-- ─── ai_usage: free-tier budgets ────────────────────────────────────────────
-- `day` is the UTC date (the providers' daily limits reset at midnight UTC).
create table if not exists public.ai_usage (
  day         date not null,
  provider    text not null,
  model       text not null,
  calls       integer not null default 0,
  tokens_in   bigint not null default 0,
  tokens_out  bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (day, provider, model)
);

-- Adds to a day's counts in one statement, so parallel calls never lose an update.
create or replace function public.ai_usage_add(
  p_day date, p_provider text, p_model text, p_calls integer, p_tokens_in bigint, p_tokens_out bigint
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage as u (day, provider, model, calls, tokens_in, tokens_out)
  values (p_day, p_provider, p_model, greatest(p_calls, 0), greatest(p_tokens_in, 0), greatest(p_tokens_out, 0))
  on conflict (day, provider, model) do update
    set calls = u.calls + excluded.calls,
        tokens_in = u.tokens_in + excluded.tokens_in,
        tokens_out = u.tokens_out + excluded.tokens_out,
        updated_at = now();
$$;

-- ─── ai_requests: Ask and Go deeper caps (rolling 24 hours) ─────────────────
-- device_id is null when the request had no known device id (older apps share one bucket).
create table if not exists public.ai_requests (
  id          bigint generated always as identity primary key,
  device_id   text,
  kind        text not null check (kind in ('ask', 'deeper')),
  date        date,
  story_id    text,
  provider    text,
  ok          boolean,
  created_at  timestamptz not null default now()
);
create index if not exists ai_requests_kind_created_at_idx on public.ai_requests (kind, created_at desc);
create index if not exists ai_requests_device_kind_created_at_idx on public.ai_requests (device_id, kind, created_at desc);

-- ─── schedule_runs: one lock per scheduled slot ─────────────────────────────
-- e.g. (2026-10-20, 'refresh:pre-CA') or (2026-10-20, 'refresh:day-1'). The first run
-- to insert the row owns the slot.
create table if not exists public.schedule_runs (
  date         date not null,
  slot         text not null,
  status       text not null default 'running' check (status in ('running', 'done', 'error')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text,
  primary key (date, slot)
);

revoke all on public.ai_usage, public.ai_requests, public.schedule_runs from anon, authenticated;
grant all on public.ai_usage, public.ai_requests, public.schedule_runs to service_role;
alter table public.ai_usage      enable row level security;
alter table public.ai_requests   enable row level security;
alter table public.schedule_runs enable row level security;
-- (RLS on, no policies → only service_role.)

-- ─── pipeline_runs: regional sections get their own stage ───────────────────
alter table public.pipeline_runs drop constraint if exists pipeline_runs_stage_check;
alter table public.pipeline_runs add constraint pipeline_runs_stage_check
  check (stage in ('edition', 'audio', 'update', 'push', 'region'));

-- ─── Morning pushes, per reader ─────────────────────────────────────────────
-- Devices whose local time is past their wake time and that haven't had today's push:
-- stamps them (so each gets one a day, even if two ticks overlap) and returns them with
-- the edition they'll see (the latest ready one up to their local date).
--   - Devices with a timezone Postgres doesn't know are skipped.
--   - The owner only ever gets their own day's edition (if it's late, they get an alert).
--   - Everyone else waits for their own day's edition when it's due within two hours (a friend
--     in India who wakes before the owner), and otherwise gets the latest one: an Australian's
--     day starts hours before the owner's edition, and an edition over an hour late isn't waited for.
--   - While the edition for someone's local date is being written, they wait for it.
--   - Only within four hours of someone's wake time.
-- `p_now` is for tests; the functions call it without arguments.
create or replace function public.claim_due_morning_pushes(p_now timestamptz default now())
returns table (device_id text, push_token text, edition_date date, is_owner boolean)
language sql
security definer
set search_path = ''
as $$
  with zones as materialized (
    select z.name from pg_catalog.pg_timezone_names z
  ),
  -- Whose morning sets the edition's time: the owner's latest-saved device (else the latest device).
  owner as (
    select o.timezone, o.wake_time
    from public.devices o
    where o.timezone in (select name from zones) and o.wake_time is not null
    order by o.is_owner desc, o.updated_at desc
    limit 1
  ),
  valid as materialized (
    select d.device_id, d.timezone, d.wake_time
    from public.devices d
    where d.morning_push
      and d.push_token is not null
      and d.timezone in (select name from zones)
  ),
  local_now as materialized (
    select v.device_id, v.wake_time, (p_now at time zone v.timezone) as ts
    from valid v
  ),
  due as (
    select l.device_id, l.ts::date as local_date,
      (select max(b.date) from public.briefings b where b.status = 'ready' and b.date <= l.ts::date) as edition_date,
      -- When the edition dated this reader's local day is due (30 minutes before the owner wakes).
      (select ((l.ts::date + o.wake_time::time) - interval '30 minutes') at time zone o.timezone from owner o) as expected_at
    from local_now l
    join public.devices d on d.device_id = l.device_id
    where l.ts >= l.ts::date + l.wake_time::time
      -- A morning push stays a morning push: not hours later (a phone set up in the afternoon,
      -- or an edition that never came; the owner gets an alert for that).
      and l.ts < l.ts::date + l.wake_time::time + interval '4 hours'
      and (d.morning_pushed_on is null or d.morning_pushed_on < l.ts::date)
      and not exists (select 1 from public.briefings g where g.date = l.ts::date and g.status = 'generating')
  )
  update public.devices d
  set morning_pushed_on = due.local_date
  from due
  where d.device_id = due.device_id
    and due.edition_date is not null
    and (
      due.edition_date = due.local_date
      or (
        not d.is_owner
        and (due.expected_at is null or due.expected_at > p_now + interval '2 hours' or due.expected_at < p_now - interval '1 hour')
      )
    )
    and (d.morning_pushed_on is null or d.morning_pushed_on < due.local_date)
  returning d.device_id, d.push_token, due.edition_date, d.is_owner;
$$;

-- Breaking news: devices that want it and whose local time is 07:00–22:00.
create or replace function public.breaking_push_tokens()
returns table (push_token text)
language sql
stable
security definer
set search_path = ''
as $$
  with valid as materialized (
    select d.push_token, d.timezone
    from public.devices d
    where d.breaking_push = 'major'
      and d.push_token is not null
      and d.timezone in (select z.name from pg_catalog.pg_timezone_names z)
  )
  select distinct v.push_token
  from valid v
  where (now() at time zone v.timezone)::time >= time '07:00'
    and (now() at time zone v.timezone)::time < time '22:00';
$$;

revoke execute on function public.ai_usage_add(date, text, text, integer, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.claim_due_morning_pushes(timestamptz) from public, anon, authenticated;
revoke execute on function public.breaking_push_tokens() from public, anon, authenticated;
grant execute on function public.ai_usage_add(date, text, text, integer, bigint, bigint) to service_role;
grant execute on function public.claim_due_morning_pushes(timestamptz) to service_role;
grant execute on function public.breaking_push_tokens() to service_role;
