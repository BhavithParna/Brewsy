-- Brewsy: feedback from readers, daily usage counts, and an owner-only view of both.
--
-- Additions only: older apps keep saving their device row exactly as before.
--
-- devices gets (written by the app):
--   theme        the theme in use ('dune', 'whales', …)
--   app_version  which app version is running: the first 8 characters of the over-the-air
--                update id, or 'build' when the phone runs what the APK shipped with
-- New tables (readers can only add to them; nobody can read them through the app except
-- the owner's devices, through the functions below):
--   feedback     what readers send from Settings → Feedback
--   usage_days   one row per device per local day: opens, topics scrolled to, stories opened
--                by topic, listens, saves, shares, and the theme that day
-- New functions:
--   brewsy_log_usage(...)                a device reports its counts for a day (the app)
--   brewsy_is_owner()                    is the calling device one of the owner's?
--   brewsy_owner_feedback(limit)         the owner's feedback inbox, newest first
--   brewsy_owner_mark_feedback_seen(ids) marks feedback as read
--   brewsy_owner_stats()                 the owner's usage summary (installs, active phones,
--                                        themes, topics, app versions)
-- The calling device is the `x-device-id` request header, as for `devices` itself. The owner
-- functions return nothing to any device whose row isn't marked is_owner (the app can't set it).
--
-- Run it before the app update that sends feedback and usage. Safe to run more than once.

-- ─── devices ────────────────────────────────────────────────────────────────
alter table public.devices
  add column if not exists theme       text check (theme is null or char_length(theme) <= 32),
  add column if not exists app_version text check (app_version is null or char_length(app_version) <= 40);

grant insert (theme, app_version), update (theme, app_version) on public.devices to anon, authenticated;

-- ─── feedback ───────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id           bigint generated always as identity primary key,
  device_id    text check (device_id is null or char_length(device_id) between 8 and 128),
  kind         text not null default 'other' check (kind in ('idea', 'problem', 'praise', 'other')),
  message      text not null check (char_length(btrim(message)) between 1 and 2000),
  -- Optional: the reader's name, so the owner knows who to follow up with.
  name         text check (name is null or char_length(name) <= 60),
  theme        text check (theme is null or char_length(theme) <= 32),
  platform     text check (platform is null or char_length(platform) <= 20),
  app_version  text check (app_version is null or char_length(app_version) <= 40),
  created_at   timestamptz not null default now(),
  seen_at      timestamptz
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

revoke all on public.feedback from anon, authenticated;
grant all on public.feedback to service_role;
grant insert (device_id, kind, message, name, theme, platform, app_version) on public.feedback to anon, authenticated;

alter table public.feedback enable row level security;
drop policy if exists "device can send feedback as itself" on public.feedback;
create policy "device can send feedback as itself"
  on public.feedback for insert to anon, authenticated
  with check (device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id'));

-- At most 20 a day from one device, so a stuck button can't flood the inbox.
create or replace function public.brewsy_feedback_limit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback
      where device_id = new.device_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too much feedback from this device today' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.brewsy_feedback_limit() from public, anon, authenticated;

drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback
  for each row execute function public.brewsy_feedback_limit();

-- ─── usage_days ─────────────────────────────────────────────────────────────
create table if not exists public.usage_days (
  device_id    text not null check (char_length(device_id) between 8 and 128),
  day          date not null,
  opens        integer not null default 0,
  theme        text,
  -- Sections of Today the reader scrolled to: topics ('ai', 'oceans', …) and 'summary',
  -- 'local', 'radar', 'markets', 'updates'.
  topics_seen  text[] not null default '{}',
  -- Stories opened (Learn more, read aloud or shared), by topic: {"ai": 3, "world": 1}.
  opened       jsonb not null default '{}',
  listens      integer not null default 0,
  saves        integer not null default 0,
  shares       integer not null default 0,
  app_version  text,
  updated_at   timestamptz not null default now(),
  primary key (device_id, day)
);
create index if not exists usage_days_day_idx on public.usage_days (day desc);

revoke all on public.usage_days from anon, authenticated;
grant all on public.usage_days to service_role;
alter table public.usage_days enable row level security;
-- No policies: only brewsy_log_usage (below) writes it, and only the owner functions read it.

-- The app sends the whole day's counts each time (not increments), so a retry or a second send
-- never double-counts: each count keeps the larger of what's stored and what arrived.
create or replace function public.brewsy_log_usage(
  p_day date,
  p_opens integer,
  p_theme text,
  p_topics text[],
  p_opened jsonb,
  p_listens integer,
  p_saves integer,
  p_shares integer,
  p_app_version text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d text := nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id';
  topics text[];
  opened jsonb;
begin
  if d is null or char_length(d) not between 8 and 128 then return; end if;
  -- Only installs the server knows (the app saves its device row first).
  if not exists (select 1 from public.devices where device_id = d) then return; end if;
  -- A local day near today, wherever the reader is.
  if p_day is null or p_day < current_date - 3 or p_day > current_date + 1 then return; end if;

  select coalesce(array_agg(distinct t), '{}') into topics
  from (select t from unnest(coalesce(p_topics, '{}')) as t where t ~ '^[a-z_-]{1,24}$' limit 40) s;

  select coalesce(jsonb_object_agg(k, least(v::integer, 1000)), '{}') into opened
  from (
    select key as k, value as v from jsonb_each_text(coalesce(p_opened, '{}'))
    where key ~ '^[a-z_-]{1,24}$' and value ~ '^[0-9]{1,6}$'
    limit 40
  ) s;

  insert into public.usage_days as u
    (device_id, day, opens, theme, topics_seen, opened, listens, saves, shares, app_version)
  values (
    d, p_day,
    least(greatest(coalesce(p_opens, 0), 0), 1000),
    left(p_theme, 32),
    topics,
    opened,
    least(greatest(coalesce(p_listens, 0), 0), 1000),
    least(greatest(coalesce(p_saves, 0), 0), 1000),
    least(greatest(coalesce(p_shares, 0), 0), 1000),
    left(p_app_version, 40)
  )
  on conflict (device_id, day) do update set
    opens = greatest(u.opens, excluded.opens),
    theme = coalesce(excluded.theme, u.theme),
    topics_seen = (select coalesce(array_agg(distinct t), '{}')
                   from unnest(u.topics_seen || excluded.topics_seen) as t),
    opened = (select coalesce(jsonb_object_agg(k, greatest(coalesce((u.opened ->> k)::integer, 0),
                                                           coalesce((excluded.opened ->> k)::integer, 0))), '{}')
              from jsonb_object_keys(u.opened || excluded.opened) as k),
    listens = greatest(u.listens, excluded.listens),
    saves = greatest(u.saves, excluded.saves),
    shares = greatest(u.shares, excluded.shares),
    app_version = coalesce(excluded.app_version, u.app_version),
    updated_at = now();
end;
$$;
revoke execute on function public.brewsy_log_usage(date, integer, text, text[], jsonb, integer, integer, integer, text)
  from public;
grant execute on function public.brewsy_log_usage(date, integer, text, text[], jsonb, integer, integer, integer, text)
  to anon, authenticated;

-- ─── owner-only views ───────────────────────────────────────────────────────
create or replace function public.brewsy_is_owner() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.devices
    where is_owner
      and device_id = (nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id')
  );
$$;
revoke execute on function public.brewsy_is_owner() from public;
grant execute on function public.brewsy_is_owner() to anon, authenticated;

create or replace function public.brewsy_owner_feedback(p_limit integer default 200)
returns table (
  id bigint, created_at timestamptz, kind text, message text, name text,
  theme text, platform text, app_version text, seen boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.created_at, f.kind, f.message, f.name, f.theme, f.platform, f.app_version, f.seen_at is not null
  from public.feedback f
  where public.brewsy_is_owner()
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke execute on function public.brewsy_owner_feedback(integer) from public;
grant execute on function public.brewsy_owner_feedback(integer) to anon, authenticated;

create or replace function public.brewsy_owner_mark_feedback_seen(p_ids bigint[]) returns void
language sql
security definer
set search_path = ''
as $$
  update public.feedback set seen_at = now()
  where public.brewsy_is_owner() and seen_at is null and id = any(p_ids);
$$;
revoke execute on function public.brewsy_owner_mark_feedback_seen(bigint[]) from public;
grant execute on function public.brewsy_owner_mark_feedback_seen(bigint[]) to anon, authenticated;

-- Counts include the owner's own phones. "Active" means the app reported a day of use; days are
-- each reader's own local days, so "today" here is the server's date give or take a day.
create or replace function public.brewsy_owner_stats() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.brewsy_is_owner() then return null; end if;

  with readers as (select * from public.devices),
  recent as (select * from public.usage_days where day >= current_date - 29),
  opened_by_topic as (
    select o.key as topic, sum(o.value::integer) as n
    from recent r, jsonb_each_text(r.opened) o
    group by o.key
  ),
  seen_by_topic as (
    select t as topic, count(*) as n
    from recent r, unnest(r.topics_seen) t
    group by t
  ),
  daily as (
    select g.day::date as day,
           count(distinct u.device_id) as phones,
           coalesce(sum(u.opens), 0) as opens
    from generate_series(current_date - 13, current_date, interval '1 day') g(day)
    left join public.usage_days u on u.day = g.day::date
    group by g.day
  )
  select jsonb_build_object(
    'generated_at', now(),
    'installs', (select count(*) from readers),
    'push_ok', (select count(*) from readers where push_token is not null),
    'seen_7d', (select count(*) from readers where updated_at > now() - interval '7 days'),
    'active_today', (select count(distinct device_id) from public.usage_days where day >= current_date),
    'active_7d', (select count(distinct device_id) from public.usage_days where day >= current_date - 6),
    'active_30d', (select count(distinct device_id) from recent),
    'totals_30d', jsonb_build_object(
      'opens', (select coalesce(sum(opens), 0) from recent),
      'listens', (select coalesce(sum(listens), 0) from recent),
      'saves', (select coalesce(sum(saves), 0) from recent),
      'shares', (select coalesce(sum(shares), 0) from recent),
      'stories_opened', (select coalesce(sum(n), 0) from opened_by_topic)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'phones', phones, 'opens', opens) order by day), '[]') from daily),
    'themes', (select coalesce(jsonb_agg(jsonb_build_object('name', theme, 'n', n) order by n desc, theme), '[]')
               from (select coalesce(theme, 'unknown') as theme, count(*) as n from readers group by 1) s),
    'topics_seen', (select coalesce(jsonb_agg(jsonb_build_object('name', topic, 'n', n) order by n desc, topic), '[]') from seen_by_topic),
    'topics_opened', (select coalesce(jsonb_agg(jsonb_build_object('name', topic, 'n', n) order by n desc, topic), '[]') from opened_by_topic),
    'topics_followed', (select coalesce(jsonb_agg(jsonb_build_object('name', t, 'n', n) order by n desc, t), '[]')
                        from (select t, count(*) as n from readers, unnest(topics) t group by t) s),
    'regions', (select coalesce(jsonb_agg(jsonb_build_object('name', region, 'n', n) order by n desc, region), '[]')
                from (select coalesce(region, 'unset') as region, count(*) as n from readers group by 1) s),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('name', v, 'n', n) order by n desc, v), '[]')
                 from (select coalesce(app_version, 'older app') as v, count(*) as n from readers group by 1) s),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('name', p, 'n', n) order by n desc, p), '[]')
                  from (select coalesce(platform, '?') as p, count(*) as n from readers group by 1) s),
    'feedback_new', (select count(*) from public.feedback where seen_at is null),
    'feedback_total', (select count(*) from public.feedback)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.brewsy_owner_stats() from public;
grant execute on function public.brewsy_owner_stats() to anon, authenticated;
