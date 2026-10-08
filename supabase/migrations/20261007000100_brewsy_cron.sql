-- Brewsy: wake the daily-briefing function every 10 minutes.
--
-- The project URL and the shared secret live in private.config, which only the
-- database owner can read (no API access: the `private` schema isn't exposed,
-- RLS is on and there are no policies). Fill it in once — see
-- docs/BACKEND_SETUP.md, step "Connect the timer". Until both rows exist the
-- job runs but does nothing.

-- Supabase's extension hook grants `postgres` what it needs on schema cron.
-- (No extra "grant all ... in schema cron to postgres": run as postgres it
-- creates self-grants that make any later `create extension pg_cron` fail.)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key    text primary key,
  value  text not null
);
alter table private.config enable row level security;
revoke all on private.config from public, anon, authenticated;

-- Re-running cron.schedule with the same name replaces the job.
select cron.schedule(
  'brewsy-tick',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select value from private.config where key = 'project_url') || '/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brewsy-secret', (select value from private.config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (select 1 from private.config where key = 'project_url')
    and exists (select 1 from private.config where key = 'cron_secret');
  $job$
);
