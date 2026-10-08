// Shape of one daily edition. The backend writes exactly this JSON into the
// `briefings` table (column `data`), and the app reads it back.
// Keep in sync with supabase/functions/_shared/types.ts.

export type Topic =
  | 'ai'
  | 'tech'
  | 'business'
  | 'world'
  | 'politics'
  | 'science'
  | 'health'
  | 'climate'
  | 'autos'
  | 'gaming'
  | 'sports'
  | 'entertainment'
  | 'crypto';

/** Order sections appear in on Today. */
export const TOPICS: Topic[] = [
  'ai',
  'tech',
  'business',
  'world',
  'politics',
  'science',
  'health',
  'climate',
  'autos',
  'gaming',
  'sports',
  'entertainment',
  'crypto',
];

export type SourceRef = {
  /** Outlet name, e.g. "BBC News". */
  name: string;
  url: string;
  /** Article title, when known. */
  title?: string;
};

export type KeyPlayer = { name: string; role: string };
export type KeyTerm = { term: string; definition: string };

export type Story = {
  /** Slug, unique within its edition. */
  id: string;
  topic: Topic;
  headline: string;
  /** One-line subtitle. */
  dek: string;
  /** 2–4 sentences. */
  whatHappened: string;
  /** 1–3 sentences. */
  whyItMatters: string;
  // ---- Layer 2 ("Learn more"), generated with the edition ----
  /** Plain-language version with an everyday analogy. */
  explainSimply: string;
  /** 1–2 short paragraphs separated by a blank line. */
  background: string;
  keyPlayers: KeyPlayer[];
  keyTerms: KeyTerm[];
  /** 1–3 things to watch in the coming days or weeks. */
  whatToWatch: string[];
  readTimeMinutes: number;
  /** Main sources, shown as small links under the story. */
  sources: SourceRef[];
  /** Every article this story was built from. */
  allSources: SourceRef[];
  imageUrl: string | null;
  /** Still unfolding: shown with a "Developing" label. */
  developing?: boolean;
  /** When a "Since this morning" story was added (ISO time). */
  addedAt?: string;
};

/** "Also happening": one line about something noteworthy that didn't get a full story. */
export type AlsoItem = {
  /** Slug, unique within its edition. */
  id: string;
  topic: Topic;
  /** The one line (max ~16 words). */
  headline: string;
  /** 2–3 sentences, shown under "Learn more". */
  whatHappened: string;
  /** 1 sentence, may be empty. */
  whyItMatters: string;
  developing?: boolean;
  sources: SourceRef[];
};

/** "How this briefing was made". */
export type Coverage = {
  articlesScanned: number;
  /** Feeds that answered / feeds tried. */
  feedsOk: number;
  feedsTotal: number;
  /** Feeds that failed even after a retry (source ids). */
  feedsFailed: string[];
  /** Distinct outlets with at least one article. */
  outlets: number;
  /** Articles grouped into distinct stories. */
  storiesGrouped: number;
  fullStories: number;
  alsoHappening: number;
  /** Stories that had to be included (5+ major outlets, or a wire "breaking" flag). */
  mustInclude: number;
  /** Stories the second "editor" pass added. */
  addedByEditor: number;
};

export type ListenMode = 'quick' | 'full';

/** One spoken chapter: the intro + 60-second summary, a story, or the outro. */
export type AudioChapter = {
  /** The story this chapter reads, or null for the intro and the outro. */
  storyId: string | null;
  title: string;
  /** What the narrator says. The app reads it aloud on the device if there's no MP3. */
  script: string;
  /** This chapter on its own, when the server made audio. */
  url: string | null;
  /** Seconds into the combined file where this chapter starts. */
  start: number;
  /** Seconds (estimated from the word count when there's no MP3). */
  duration: number;
};

export type AudioEdition = {
  mode: ListenMode;
  chapters: AudioChapter[];
  /** The whole briefing in one MP3, or null if text-to-speech isn't set up on the server. */
  url: string | null;
  /** Seconds. */
  duration: number;
  /** e.g. "OpenAI · marin", or null when there's no MP3. */
  voice: string | null;
};

export type BriefingAudio = {
  generatedAt: string;
  quick: AudioEdition | null;
  full: AudioEdition | null;
};

export type CalendarEvent = {
  /** Display label, e.g. "1:00 PM ET", "Today", "Thu". */
  time: string | null;
  title: string;
  topic?: Topic;
};

export type MarketQuote = {
  id: string;
  label: string;
  value: number;
  /** Percent for most quotes, basis points for yields. */
  change: number;
  changeUnit: 'percent' | 'bp';
  format: 'index' | 'usd' | 'percent';
};

export type Briefing = {
  /** Local calendar date of the edition, YYYY-MM-DD. */
  date: string;
  generatedAt: string;
  /** The 4 one-sentence takeaways. */
  summary: string[];
  /** Ranked: stories[0] is the most important. */
  stories: Story[];
  calendar: CalendarEvent[];
  markets: MarketQuote[];
  /** Noteworthy items that didn't get a full story (up to ~15). */
  alsoHappening?: AlsoItem[];
  /** Major news found by the daytime checks, newest first. Stored in `briefings.updates`. */
  sinceThisMorning?: Story[];
  coverage?: Coverage;
  /** Listening versions. Stored in `briefings.audio`, made a few minutes after the edition. */
  audio?: BriefingAudio | null;
  /** True for the bundled sample edition used before the backend exists. */
  isSample?: boolean;
};

/** Layer 3: the on-demand "Go deeper" explainer, written from the story's sources. */
export type DeepDive = {
  /** 2–3 paragraphs separated by blank lines. */
  context: string;
  perspectives: { label: string; text: string }[];
  numbers: { figure: string; meaning: string }[];
  openQuestions: string[];
  generatedAt: string;
};

export type AskAnswer = {
  answer: string;
  /** False when the sources don't contain the answer. */
  answeredFromSources: boolean;
};
