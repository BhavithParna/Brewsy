-- Brewsy: tables + row-level security.
--
-- Who can do what:
--   anon (the app, using the publishable key)
--     briefings    read ready editions only (date, status, data, generated_at)
--     deep_dives   read cached "Go deeper" results
--     devices      insert / update / read ITS OWN row only — the row whose
--                  device_id equals the `x-device-id` request header
--     story_context, ask_log   no access
--   service_role (the edge functions) — everything; it bypasses RLS.

-- ─── briefings: one edition per day ─────────────────────────────────────────
create table public.briefings (
  date          date primary key,
  status        text not null default 'generating' check (status in ('generating', 'ready', 'error')),
  data          jsonb,
  started_at    timestamptz,
  generated_at  timestamptz,
  pushed_at     timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint briefings_ready_has_data check (status <> 'ready' or data is not null)
);

-- ─── story_context: the article text each story was written from ───────────
-- Read only by go-deeper / ask, so answers stay grounded in the same sources.
create table public.story_context (
  date        date not null,
  story_id    text not null,
  sources     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (date, story_id)
);

-- ─── deep_dives: cached "Go deeper with AI" results ─────────────────────────
create table public.deep_dives (
  story_key   text primary key,                -- "<date>:<storyId>"
  date        date not null,
  story_id    text not null,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);
create index deep_dives_date_idx on public.deep_dives (date);

-- ─── devices: the reader's phone + preferences ──────────────────────────────
create table public.devices (
  device_id         text primary key check (char_length(device_id) between 8 and 128),
  push_token        text check (push_token is null or char_length(push_token) <= 300),
  platform          text check (platform is null or char_length(platform) <= 20),
  timezone          text not null default 'Asia/Kolkata' check (char_length(timezone) <= 64),
  wake_time         text not null default '05:30' check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  topics            text[] not null default array['ai', 'tech', 'business', 'world']
                      check (topics <@ array['ai', 'tech', 'business', 'world']),
  disabled_sources  text[] not null default '{}' check (cardinality(disabled_sources) <= 50),
  morning_push      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- The daily job reads preferences from the most recently updated device.
create index devices_updated_at_idx on public.devices (updated_at desc);

-- ─── ask_log: one row per "Ask a question" (for the daily cap) ──────────────
create table public.ask_log (
  id          bigint generated always as identity primary key,
  date        date not null,
  story_id    text not null,
  question    text not null check (char_length(question) <= 300),
  answered    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index ask_log_created_at_idx on public.ask_log (created_at);

-- ─── keep updated_at current ────────────────────────────────────────────────
create function public.brewsy_touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.brewsy_touch_updated_at() from public, anon, authenticated;

create trigger briefings_touch before update on public.briefings
  for each row execute function public.brewsy_touch_updated_at();
create trigger devices_touch before insert or update on public.devices
  for each row execute function public.brewsy_touch_updated_at();

-- ─── privileges ─────────────────────────────────────────────────────────────
-- Spelled out instead of relying on project defaults.
revoke all on public.briefings, public.story_context, public.deep_dives, public.devices, public.ask_log
  from anon, authenticated;
grant all on public.briefings, public.story_context, public.deep_dives, public.devices, public.ask_log
  to service_role;

grant select (date, status, data, generated_at) on public.briefings to anon, authenticated;
grant select on public.deep_dives to anon, authenticated;
grant select, insert (device_id, push_token, platform, timezone, wake_time, topics, disabled_sources, morning_push),
  update (device_id, push_token, platform, timezone, wake_time, topics, disabled_sources, morning_push)
  on public.devices to anon, authenticated;

-- ─── row-level security ─────────────────────────────────────────────────────
alter table public.briefings     enable row level security;
alter table public.story_context enable row level security;
alter table public.deep_dives    enable row level security;
alter table public.devices       enable row level security;
alter table public.ask_log       enable row level security;
-- (story_context and ask_log: RLS on, no policies → only service_role.)

create policy "anyone can read ready editions"
  on public.briefings for select to anon, authenticated
  using (status = 'ready');

create policy "anyone can read deep dives"
  on public.deep_dives for select to anon, authenticated
  using (true);

-- PostgREST exposes request headers as JSON in `request.headers` (names lower-cased).
-- nullif guards against the empty string a pooled connection can leave behind.
create policy "device can read its own row"
  on public.devices for select to anon, authenticated
  using (device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id'));

create policy "device can create its own row"
  on public.devices for insert to anon, authenticated
  with check (device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id'));

create policy "device can update its own row"
  on public.devices for update to anon, authenticated
  using (device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id'))
  with check (device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id'));
