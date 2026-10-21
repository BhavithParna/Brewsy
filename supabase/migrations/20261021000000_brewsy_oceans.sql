-- Brewsy: the Oceans topic (15 topics on devices).
--
-- The app can now follow and star `oceans`. The topic checks on `devices` only allowed
-- the 14 earlier topics, so every save that included oceans would be rejected, and
-- with it the wake time, push token, region and other settings.
--
-- devices gets:
--   topics         any of the 15 topics (the default starting set is unchanged)
--   focus_topics   followed topics the reader wants more of (the app allows 4).
--                  Still checked against the topics only, not against `topics`, so a
--                  stale value can never block a save; the server ignores any focus
--                  topic the reader doesn't follow (prefs.ts).
--
-- Run it before the functions and the app update that know about oceans.
-- Safe to run more than once.

alter table public.devices drop constraint if exists devices_topics_check;
alter table public.devices add constraint devices_topics_check check (
  topics <@ array[
    'ai', 'tech', 'business', 'world', 'politics', 'science', 'health', 'climate',
    'oceans', 'autos', 'gaming', 'sports', 'entertainment', 'movies', 'crypto'
  ]::text[]
);

alter table public.devices drop constraint if exists devices_focus_topics_check;
alter table public.devices add constraint devices_focus_topics_check check (
  cardinality(focus_topics) <= 6
  and focus_topics <@ array[
    'ai', 'tech', 'business', 'world', 'politics', 'science', 'health', 'climate',
    'oceans', 'autos', 'gaming', 'sports', 'entertainment', 'movies', 'crypto'
  ]::text[]
);
