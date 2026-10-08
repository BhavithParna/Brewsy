-- Brewsy: audio briefing, daytime updates, breaking pushes, run log + alerts.
--
-- briefings gets:
--   audio               the Quick/Full listening versions (chapters, MP3 URLs), made a few minutes after the edition
--   audio_status, audio_started_at, audio_error, audio_attempts   the audio stage's lock + retries
--   updates             "Since this morning" stories added during the day (newest first)
--   updates_checked_at  when the last daytime check started (every 2 h, 7am–10pm)
--   breaking_pushes     breaking-news pushes sent today (max 2)
-- devices gets breaking_push ('off' | 'major').
-- New tables (functions only): pipeline_runs (one row per run), alerts (one per day per kind).
-- New public Storage bucket `audio` (MP3s; the app streams them by URL).

-- ─── briefings ──────────────────────────────────────────────────────────────
alter table public.briefings
  add column if not exists audio               jsonb,
  add column if not exists audio_status        text check (audio_status in ('generating', 'ready', 'error')),
  add column if not exists audio_started_at    timestamptz,
  add column if not exists audio_error         text,
  add column if not exists audio_attempts      integer not null default 0,
  add column if not exists updates             jsonb not null default '[]'::jsonb,
  add column if not exists updates_checked_at  timestamptz,
  add column if not exists breaking_pushes     integer not null default 0;

-- The app reads these next to `data` (same "ready editions only" policy).
grant select (audio, updates) on public.briefings to anon, authenticated;

-- ─── devices ────────────────────────────────────────────────────────────────
alter table public.devices
  add column if not exists breaking_push text not null default 'major' check (breaking_push in ('off', 'major'));

grant insert (breaking_push), update (breaking_push) on public.devices to anon, authenticated;

-- ─── pipeline_runs: one row per edition / audio / update / push run ─────────
create table if not exists public.pipeline_runs (
  id            bigint generated always as identity primary key,
  date          date not null,
  stage         text not null check (stage in ('edition', 'audio', 'update', 'push')),
  ok            boolean not null,
  ms            integer not null default 0,
  feeds_ok      integer,
  feeds_total   integer,
  feeds_failed  text[],
  stats         jsonb,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists pipeline_runs_created_at_idx on public.pipeline_runs (created_at desc);

-- ─── alerts: problems the owner was told about (at most one per day per kind) ─
create table if not exists public.alerts (
  date        date not null,
  kind        text not null,
  detail      text,
  created_at  timestamptz not null default now(),
  primary key (date, kind)
);

revoke all on public.pipeline_runs, public.alerts from anon, authenticated;
grant all on public.pipeline_runs, public.alerts to service_role;
alter table public.pipeline_runs enable row level security;
alter table public.alerts        enable row level security;
-- (RLS on, no policies → only service_role.)

-- ─── Storage: public bucket for the MP3s ────────────────────────────────────
-- Public = readable by URL without a key. Only the functions (secret key) can write.
-- 50 MB per file is plenty (a 10-minute MP3 at 128 kbps ≈ 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
