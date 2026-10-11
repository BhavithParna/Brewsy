-- Brewsy: all 14 topics on devices, and "more of this" (focus) topics.
--
-- Fixes: the first migration only allowed topics ai/tech/business/world, so every
-- device save that included a newer topic (politics, science, …, movies) was
-- rejected, and with it the wake time, push token and other settings.
--
-- devices gets:
--   topics         any of the 14 topics; the default is the app's starting set
--   focus_topics   followed topics the reader wants more of (the app allows 4).
--                  Checked against the 14 topics only, not against `topics`, so a
--                  stale value can never block a save again; the server ignores
--                  any focus topic the reader doesn't follow (prefs.ts).
--   disabled_sources  room for every outlet (there are ≈ 85 now; the old cap was 50)
--
-- Safe to run more than once.

alter table public.devices drop constraint if exists devices_topics_check;
alter table public.devices add constraint devices_topics_check check (
  topics <@ array[
    'ai', 'tech', 'business', 'world', 'politics', 'science', 'health', 'climate',
    'autos', 'gaming', 'sports', 'entertainment', 'movies', 'crypto'
  ]::text[]
);
alter table public.devices
  alter column topics set default array['ai', 'tech', 'business', 'world', 'politics', 'science']::text[];

alter table public.devices add column if not exists focus_topics text[] not null default '{}';
alter table public.devices drop constraint if exists devices_focus_topics_check;
alter table public.devices add constraint devices_focus_topics_check check (
  cardinality(focus_topics) <= 6
  and focus_topics <@ array[
    'ai', 'tech', 'business', 'world', 'politics', 'science', 'health', 'climate',
    'autos', 'gaming', 'sports', 'entertainment', 'movies', 'crypto'
  ]::text[]
);

alter table public.devices drop constraint if exists devices_disabled_sources_check;
alter table public.devices add constraint devices_disabled_sources_check check (cardinality(disabled_sources) <= 200);

-- The app saves its row with an upsert, which needs insert and update on every column it sends.
grant insert (focus_topics), update (focus_topics) on public.devices to anon, authenticated;
