import { TOPIC_LABEL } from '@/data/topics';
import type { AlsoItem, Briefing, Story, Topic } from '@/data/types';
import { mutedMatcher } from '@/lib/curation';

/** One searchable thing in an edition: a full story, a "Since this morning" story or an "Also happening" line. */
export type SearchDoc = {
  /** Unique across editions. */
  key: string;
  date: string;
  kind: 'story' | 'update' | 'also';
  id: string;
  topic: Topic;
  headline: string;
  /** The text under the headline: what happened, then why it matters. */
  body: string;
  /** Key players' names and key terms, which also match. */
  players: string[];
  terms: string[];
  /** The item itself, for reading it in place. */
  story?: Story;
  also?: AlsoItem;
};

export type SearchHit = SearchDoc & {
  score: number;
  /**
   * Why it matched, when the headline doesn't show it: a short passage around the first match in
   * the body, or the key player or term that matched.
   */
  snippet: string | null;
};

function storyDoc(date: string, s: Story, kind: 'story' | 'update'): SearchDoc {
  return {
    key: `${date}:${kind}:${s.id}`,
    date,
    kind,
    id: s.id,
    topic: s.topic,
    headline: s.headline,
    body: [s.dek, s.whatHappened, s.whyItMatters].filter(Boolean).join(' '),
    players: s.keyPlayers.map((p) => p.name),
    terms: s.keyTerms.map((t) => t.term),
    story: s,
  };
}

/** Everything searchable in one edition. */
export function editionDocs(b: Briefing): SearchDoc[] {
  const seen = new Set<string>();
  const docs: SearchDoc[] = [];
  const add = (d: SearchDoc) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    docs.push(d);
  };
  b.stories.forEach((s) => add(storyDoc(b.date, s, 'story')));
  (b.sinceThisMorning ?? []).forEach((s) => add(storyDoc(b.date, s, 'update')));
  (b.alsoHappening ?? []).forEach((a) =>
    add({
      key: `${b.date}:also:${a.id}`,
      date: b.date,
      kind: 'also',
      id: a.id,
      topic: a.topic,
      headline: a.headline,
      body: [a.whatHappened, a.whyItMatters].filter(Boolean).join(' '),
      players: [],
      terms: [],
      also: a,
    }),
  );
  return docs;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The words of a query that search uses: lowercased, without repeats, quotes and punctuation.
 * Single letters are dropped; they match too much to be useful.
 */
export function queryWords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[“”"‘’`]/g, ' ')
    .split(/[\s,;:!?()]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w.length > 1);
  return [...new Set(words)];
}

const NOT_WORD = '[^\\p{L}\\p{N}]';

/**
 * Matches any of the words where a word starts ("open" finds OpenAI, not "reopen"). Words of two
 * letters only match whole words, so "ai" finds AI but not "airport".
 */
function wordStarts(words: string[], flags: string): RegExp {
  const parts = words.map((w) => (w.length <= 2 ? `${escapeRegExp(w)}(?=$|${NOT_WORD})` : escapeRegExp(w)));
  return new RegExp(`(^|${NOT_WORD})(${parts.join('|')})`, flags);
}

/** Counts one query word in text: whole-word matches count fully, the start of a longer word half. */
type Counter = (text: string) => number;

function counter(word: string): Counter {
  const starts = wordStarts([word], 'giu');
  const whole = new RegExp(`(^|${NOT_WORD})${escapeRegExp(word)}(?=$|${NOT_WORD})`, 'giu');
  return (text) => {
    const n = text.match(starts)?.length ?? 0;
    if (!n) return 0;
    const w = text.match(whole)?.length ?? 0;
    return w + (n - w) * 0.5;
  };
}

/** A passage of about `size` characters around the first match, cut at word boundaries. */
function snippetAround(text: string, first: RegExp, size = 150): string | null {
  const m = first.exec(text);
  if (!m) return null;
  const at = m.index + m[1].length;
  let start = Math.max(0, at - 40);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    start = space > -1 && space < at ? space + 1 : start;
  }
  let end = Math.min(text.length, start + size);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    end = space > at ? space : end;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Documents that contain every word of the query, best first: headline matches count most,
 * then names and terms, then the body.
 */
export function searchDocs(docs: SearchDoc[], query: string): SearchHit[] {
  const words = queryWords(query);
  if (!words.length) return [];
  // Built once per search, not once per document.
  const counters = words.map(counter);
  const first = wordStarts(words, 'iu');
  const hits: SearchHit[] = [];
  for (const d of docs) {
    const topic = TOPIC_LABEL[d.topic];
    const tags = [...d.players, ...d.terms].join(' · ');
    let score = 0;
    let all = true;
    let inBody = false;
    for (const c of counters) {
      const h = c(d.headline);
      const t = c(tags);
      const b = c(d.body);
      const k = c(topic);
      if (!h && !t && !b && !k) {
        all = false;
        break;
      }
      if (!h && !k) inBody = true;
      score += h * 6 + Math.min(t, 2) * 3 + Math.min(b, 3) + k * 2;
    }
    if (!all) continue;
    if (d.kind !== 'also') score += 1;
    let snippet: string | null = null;
    // When the headline doesn't show why it matched, a passage or the name that did.
    if (inBody) {
      const named = (x: string) => counters.some((c) => c(x) > 0);
      const player = d.players.find(named);
      const term = d.terms.find(named);
      snippet = snippetAround(d.body, first) ?? (player ? `Key player: ${player}` : term ? `Key term: ${term}` : null);
    }
    hits.push({ ...d, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/**
 * A check for why Today wouldn't show a result (its topic is off, or it mentions a hidden word),
 * giving null when it's there. Mirrors lib/curation.ts.
 */
export function hiddenReasons(prefs: { topics: Topic[]; mutedWords: string[] }): (d: SearchDoc) => string | null {
  const muted = mutedMatcher(prefs.mutedWords);
  return (d) => {
    if (!prefs.topics.includes(d.topic)) return `Not in your edition: ${TOPIC_LABEL[d.topic]} is turned off.`;
    const text = d.story
      ? `${d.story.headline}\n${d.story.dek}\n${d.story.whatHappened}`
      : `${d.headline}\n${d.also?.whatHappened ?? ''}`;
    if (muted?.test(text)) return 'Not in your edition: it mentions a word you’ve hidden.';
    return null;
  };
}

export type Segment = { text: string; hit: boolean };

/** Splits text into plain and matching parts, for highlighting. */
export function highlight(text: string, words: string[]): Segment[] {
  if (!words.length) return [{ text, hit: false }];
  const re = wordStarts(words, 'giu');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    const end = start + m[2].length;
    if (start > last) out.push({ text: text.slice(last, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    last = end;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}

// ─── "Earlier in Brewsy" ───────────────────────────────────────────────────

/** "Bank of England (BoE)" -> "Bank of England". */
export function plainName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Small words that can sit inside a name: Bank of England, Charles de Gaulle. */
const JOINERS = new Set([
  'of', 'de', 'la', 'le', 'du', 'des', 'von', 'van', 'der', 'al', 'el', 'bin', 'for', 'da', 'do', 'y',
]);

/**
 * A specific name ("Bank of England", "OpenAI", "Justice Elena Kagan") rather than a description
 * ("Bond investors", "The attackers", "France, Italy and the UK").
 */
export function isProperName(name: string): boolean {
  const n = plainName(name);
  if (n.length < 2 || n.length > 32 || /[,;]/.test(n)) return false;
  const words = n.split(' ');
  if (words[0].toLowerCase() === 'the' && words.length > 1) return isProperName(words.slice(1).join(' '));
  return words.every((w, i) => /^[\p{Lu}\p{N}]/u.test(w) || (i > 0 && i < words.length - 1 && JOINERS.has(w)));
}

/** Names worth matching on: key players (and acronyms in brackets), plus key terms. */
function storyNames(s: Story): { players: string[]; terms: string[] } {
  const players = new Set<string>();
  for (const p of s.keyPlayers) {
    const name = plainName(p.name);
    if (name.length > 2) players.add(name);
    const acronym = p.name.match(/\(([A-Z][A-Za-z0-9&.-]{1,9})\)/)?.[1];
    if (acronym) players.add(acronym);
  }
  const terms = s.keyTerms.map((t) => plainName(t.term)).filter((t) => t.length > 3);
  return { players: [...players], terms };
}

const mentionCache = new Map<string, RegExp>();

/** The name as a whole word or phrase, ignoring case. */
function mentions(text: string, name: string): boolean {
  let re = mentionCache.get(name);
  if (!re) {
    re = new RegExp(`(^|${NOT_WORD})${escapeRegExp(name)}(?=$|${NOT_WORD})`, 'iu');
    if (mentionCache.size > 500) mentionCache.clear();
    mentionCache.set(name, re);
  }
  return re.test(text);
}

export type RelatedStory = { date: string; story: Story };

const storyText = (s: Story) => `${s.headline}\n${s.dek}\n${s.whatHappened}`;

/**
 * Stories from earlier editions about the same people, companies or ideas, newest first.
 * Names are weighted by how rare they are across the editions at hand, so a name that's in half
 * the news (a president, a big tech company) can't make two stories "related" on its own.
 */
export function relatedStories(story: Story, editionDate: string, editions: Briefing[], max = 3): RelatedStory[] {
  const { players, terms } = storyNames(story);
  const names = [...players.map((n) => ({ n, player: true })), ...terms.map((n) => ({ n, player: false }))];
  if (!names.length) return [];

  // Every story at hand, once each.
  const corpus: { date: string; story: Story; text: string; theirs: Set<string> }[] = [];
  for (const b of editions) {
    const seen = new Set<string>();
    for (const s of [...b.stories, ...(b.sinceThisMorning ?? [])]) {
      if (seen.has(s.id) || (b.date === editionDate && s.id === story.id)) continue;
      seen.add(s.id);
      corpus.push({
        date: b.date,
        story: s,
        text: storyText(s),
        theirs: new Set(s.keyPlayers.map((p) => plainName(p.name).toLowerCase())),
      });
    }
  }
  if (!corpus.length) return [];

  // Rarer names say more: weight = log((N + 1) / (stories mentioning it + 1)).
  const weight = new Map<string, number>();
  for (const { n } of names) {
    const df = corpus.filter((c) => c.theirs.has(n.toLowerCase()) || mentions(c.text, n)).length;
    weight.set(n, Math.log((corpus.length + 1) / (df + 1)));
  }

  const found: (RelatedStory & { score: number })[] = [];
  for (const c of corpus) {
    if (c.date >= editionDate) continue;
    let score = 0;
    for (const { n, player } of names) {
      const w = weight.get(n) ?? 0;
      const shared = player && c.theirs.has(n.toLowerCase());
      if (mentions(c.story.headline, n)) score += w * 1.5;
      else if (shared || mentions(c.text, n)) score += w;
      if (shared) score += w * 0.5;
    }
    if (c.story.topic === story.topic) score += 0.5;
    if (score >= 3) found.push({ date: c.date, story: c.story, score });
  }

  // The strongest matches, one per edition, shown as a timeline (newest first).
  const best = new Map<string, RelatedStory & { score: number }>();
  for (const f of found.sort((a, b) => b.score - a.score)) if (!best.has(f.date)) best.set(f.date, f);
  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ date, story: s }) => ({ date, story: s }));
}

/**
 * Names worth searching from an edition, for suggestions: ones in several stories first, then each
 * story's main player in edition order, so the list spans the whole edition.
 */
export function editionNames(b: Briefing, max = 8): string[] {
  const tally = new Map<string, { name: string; n: number; order: number }>();
  b.stories.forEach((s, rank) => {
    s.keyPlayers.forEach((p, pos) => {
      const name = plainName(p.name);
      if (name.length < 3 || name.length > 24 || !isProperName(name)) return;
      const k = name.toLowerCase();
      const cur = tally.get(k);
      if (cur) cur.n++;
      else tally.set(k, { name, n: 1, order: pos * 1000 + rank });
    });
  });
  return [...tally.values()]
    .sort((a, b) => (b.n > 1 ? 1 : 0) - (a.n > 1 ? 1 : 0) || a.order - b.order)
    .slice(0, max)
    .map((t) => t.name);
}
