import { TOPICS, type AlsoItem, type Briefing, type Story, type Topic } from '@/data/types';
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

export type CuratedEdition = {
  /** Followed topics with anything to show: focus topics first, then the rest in the usual order. */
  groups: TopicGroup[];
  /** "Since this morning" stories in followed topics. */
  updates: Story[];
  /** Stories and lines left out because they mention a muted word. */
  hidden: number;
  /** The 60-second takeaways, minus any that mention a muted word. */
  summary: string[];
};

type Prefs = Pick<Settings, 'topics' | 'focusTopics' | 'mutedWords'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A whole-word, case-insensitive matcher for the muted words, or null when there are none. */
export function mutedMatcher(words: string[]): RegExp | null {
  const parts = words.map((w) => w.trim()).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${parts.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

/** Topics in the order Today shows them: the ones the reader wants more of first. */
export function orderedTopics(prefs: Pick<Settings, 'topics' | 'focusTopics'>): Topic[] {
  const followed = TOPICS.filter((t) => prefs.topics.includes(t));
  const focus = followed.filter((t) => prefs.focusTopics.includes(t));
  return [...focus, ...followed.filter((t) => !focus.includes(t))];
}

/**
 * What Today shows for an edition: the reader's topics in their order, each with its stories and
 * quick hits, minus anything that mentions a muted word.
 */
export function curateEdition(briefing: Briefing, prefs: Prefs): CuratedEdition {
  const muted = mutedMatcher(prefs.mutedWords);
  let hidden = 0;
  const keep = (text: string) => {
    if (muted && muted.test(text)) {
      hidden++;
      return false;
    }
    return true;
  };
  const storyText = (s: Story) => `${s.headline}\n${s.dek}\n${s.whatHappened}`;

  const stories = briefing.stories.filter((s) => prefs.topics.includes(s.topic) && keep(storyText(s)));
  const also = (briefing.alsoHappening ?? []).filter(
    (a) => prefs.topics.includes(a.topic) && keep(`${a.headline}\n${a.whatHappened}`),
  );
  const updates = (briefing.sinceThisMorning ?? []).filter(
    (s) => prefs.topics.includes(s.topic) && keep(storyText(s)),
  );

  const groups = orderedTopics(prefs)
    .map((topic) => ({
      topic,
      stories: stories.filter((s) => s.topic === topic),
      quick: also.filter((a) => a.topic === topic),
      focus: prefs.focusTopics.includes(topic),
    }))
    .filter((g) => g.stories.length > 0 || g.quick.length > 0);

  const summary = briefing.summary.filter((t) => !muted || !muted.test(t));

  return { groups, updates, hidden, summary };
}
