import { normalizeOutlet } from '../../supabase/functions/_shared/sources';
import { TOPICS, type AlsoItem, type Briefing, type SourceRef, type Story, type Topic } from '@/data/types';
import type { Region } from '@/lib/region';
import type { Settings } from '@/state/settings';

/** One topic section on Today: its full stories, then its one-line quick hits. */
export type TopicGroup = {
  topic: Topic;
  stories: Story[];
  /** This topic's "Also happening" lines. */
  quick: AlsoItem[];
  /** The reader asked for more of this topic. */
  focus: boolean;
};

/** The reader's local section, ready to show: named after the region ("Canada"). */
export type LocalGroup = {
  region: Region;
  label: string;
  /** The section's own date (the region's local date): stories in it are saved and explained under it. */
  date: string;
  stories: Story[];
  quick: AlsoItem[];
};

export type CuratedEdition = {
  /** Followed topics with anything to show: focus topics first, then the rest in the usual order. */
  groups: TopicGroup[];
  /** "Since this morning" stories in followed topics. */
  updates: Story[];
  /** The local section, whatever its stories' topics, or null when there's nothing to show. */
  local: LocalGroup | null;
  /** Stories and lines left out because they mention a muted word. */
  hidden: number;
  /** The 60-second takeaways, minus any that mention a muted word. */
  summary: string[];
};

type Prefs = Pick<Settings, 'topics' | 'focusTopics' | 'mutedWords' | 'disabledOutlets' | 'region'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A whole-word, case-insensitive matcher for the muted words, or null when there are none. */
export function mutedMatcher(words: string[]): RegExp | null {
  const parts = words.map((w) => w.trim()).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${parts.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

const outletKey = (name: string) => normalizeOutlet(name).toLowerCase();

/** Tells whether a source is from an outlet the reader turned off (null when none are off). */
export function outletMuter(disabledOutlets: string[]): ((source: SourceRef) => boolean) | null {
  if (!disabledOutlets.length) return null;
  const off = new Set(disabledOutlets.map(outletKey));
  return (source) => off.has(outletKey(source.name));
}

/** A source list without the outlets the reader turned off. */
export function visibleSources(sources: SourceRef[], disabledOutlets: string[]): SourceRef[] {
  const isOff = outletMuter(disabledOutlets);
  return isOff ? sources.filter((s) => !isOff(s)) : sources;
}

/** Topics in the order Today shows them: the ones the reader wants more of first. */
export function orderedTopics(prefs: Pick<Settings, 'topics' | 'focusTopics'>): Topic[] {
  const followed = TOPICS.filter((t) => prefs.topics.includes(t));
  const focus = followed.filter((t) => prefs.focusTopics.includes(t));
  return [...focus, ...followed.filter((t) => !focus.includes(t))];
}

/**
 * What Today shows for an edition: the reader's topics in their order, each with its stories and
 * quick hits, and the reader's local section; minus anything that mentions a muted word, and
 * anything only turned-off outlets reported (the rest lose those outlets' links).
 */
export function curateEdition(briefing: Briefing, prefs: Prefs): CuratedEdition {
  const muted = mutedMatcher(prefs.mutedWords);
  const isOff = outletMuter(prefs.disabledOutlets);
  let hidden = 0;
  const keep = (text: string) => {
    if (muted && muted.test(text)) {
      hidden++;
      return false;
    }
    return true;
  };
  const storyText = (s: Story) => `${s.headline}\n${s.dek}\n${s.whatHappened}`;

  const trimStory = (s: Story): Story | null => {
    if (!isOff) return s;
    const all = s.allSources?.length ? s.allSources : (s.sources ?? []);
    if (all.length && all.every(isOff)) return null;
    const allSources = (s.allSources ?? []).filter((x) => !isOff(x));
    const main = (s.sources ?? []).filter((x) => !isOff(x));
    if (main.length === s.sources?.length && allSources.length === s.allSources?.length) return s;
    return { ...s, sources: main.length ? main : allSources.slice(0, 2), allSources };
  };
  const trimAlso = (a: AlsoItem): AlsoItem | null => {
    if (!isOff || !a.sources?.length) return a;
    const sources = a.sources.filter((x) => !isOff(x));
    if (!sources.length) return null;
    return sources.length === a.sources.length ? a : { ...a, sources };
  };
  const stories = (list: Story[], wanted: (s: Story) => boolean) =>
    list.filter(wanted).flatMap((s) => trimStory(s) ?? []).filter((s) => keep(storyText(s)));
  const quick = (list: AlsoItem[], wanted: (a: AlsoItem) => boolean) =>
    list
      .filter(wanted)
      .flatMap((a) => trimAlso(a) ?? [])
      .filter((a) => keep(`${a.headline}\n${a.whatHappened}`));

  const followed = (x: { topic: Topic }) => prefs.topics.includes(x.topic);
  const world = stories(briefing.stories, followed);
  const also = quick(briefing.alsoHappening ?? [], followed);
  const updates = stories(briefing.sinceThisMorning ?? [], followed);

  const groups = orderedTopics(prefs)
    .map((topic) => ({
      topic,
      stories: world.filter((s) => s.topic === topic),
      quick: also.filter((a) => a.topic === topic),
      focus: prefs.focusTopics.includes(topic),
    }))
    .filter((g) => g.stories.length > 0 || g.quick.length > 0);

  // Local news isn't split by topic: a reader who chose a region sees all of its section.
  const r = briefing.regional;
  let local: LocalGroup | null = null;
  if (r && r.region === prefs.region) {
    const all = () => true;
    local = { region: r.region, label: r.label, date: r.date, stories: stories(r.stories, all), quick: quick(r.also, all) };
    if (!local.stories.length && !local.quick.length) local = null;
  }

  const summary = briefing.summary.filter((t) => !muted || !muted.test(t));

  return { groups, updates, local, hidden, summary };
}
