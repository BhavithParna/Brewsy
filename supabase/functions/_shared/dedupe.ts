// Groups items that cover the same event (from different outlets) into clusters.

import { isHeadlineOnly, type FeedItem } from './feeds.ts';
import type { TopicHint } from './sources.ts';
import { tokens } from './text.ts';

export type Cluster = {
  id: string;
  items: FeedItem[];
  outlets: string[];
  topicHints: TopicHint[];
  /** Representative headline and teaser. */
  title: string;
  summary: string;
  latestAt: string;
  score: number;
};

// British/American spellings that otherwise stop "centre"/"center" matching.
const SPELLING: Record<string, string> = {
  centre: 'center', centres: 'center', defence: 'defense', colour: 'color', organisation: 'organization',
  programme: 'program', licence: 'license', labour: 'labor', favour: 'favor', analyse: 'analyze',
};

function normTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokens(s)) {
    let w = SPELLING[t] ?? t;
    if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    out.add(w);
  }
  return out;
}

/**
 * IDF-weighted overlap coefficient: shared rare words ("Skydance", "Kagan")
 * count far more than shared common ones ("market", "says").
 */
function similarity(a: Set<string>, b: Set<string>, idf: Map<string, number>): { score: number; shared: number } {
  let shared = 0;
  let sharedW = 0;
  let wa = 0;
  let wb = 0;
  for (const t of a) wa += idf.get(t) ?? 1;
  for (const t of b) {
    const w = idf.get(t) ?? 1;
    wb += w;
    if (a.has(t)) {
      shared++;
      sharedW += w;
    }
  }
  const denom = Math.min(wa, wb);
  return { score: denom ? sharedW / denom : 0, shared };
}

export type ClusterOptions = {
  /** Merge when weighted overlap ≥ this and at least `minShared` words are shared. */
  threshold?: number;
  minShared?: number;
  maxClusters?: number;
  now?: Date;
};

/** Clusters kept for the AI to choose from (the rest are low-scoring singletons). */
export const MAX_CLUSTERS = 280;

/** Every topic hint a source can carry, so each beat keeps some candidates. */
const ALL_HINTS: TopicHint[] = [
  'ai', 'tech', 'business', 'world', 'politics', 'science', 'health', 'climate',
  'autos', 'gaming', 'sports', 'entertainment', 'crypto', 'mixed',
];

export function clusterItems(items: FeedItem[], opts: ClusterOptions = {}): Cluster[] {
  return clusterAll(items, opts).clusters;
}

/** Like clusterItems, plus how many distinct stories were found before the cap. */
export function clusterAll(items: FeedItem[], opts: ClusterOptions = {}): { clusters: Cluster[]; total: number } {
  const threshold = opts.threshold ?? 0.5;
  const minShared = opts.minShared ?? 3;
  const maxClusters = opts.maxClusters ?? MAX_CLUSTERS;
  const nowMs = (opts.now ?? new Date()).getTime();

  const toks = items.map((it) => normTokens(`${it.title} ${it.title} ${it.summary.slice(0, 220)}`));
  const titleToks = items.map((it) => normTokens(it.title));

  // Document frequency → IDF.
  const df = new Map<string, number>();
  for (const set of toks) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + items.length / n));

  const hasTeaser = items.map((it) => it.summary.length >= 40);
  const pairScore = (i: number, j: number): number => {
    const t = similarity(titleToks[i], titleToks[j], idf);
    const f = similarity(toks[i], toks[j], idf);
    const ts = t.shared >= minShared ? t.score : 0;
    const fs = f.shared >= minShared ? f.score : 0;
    // Short headlines can match on generic words alone ("win", "Nobel", "prize").
    // When both items have a teaser, the teasers must back the title match up.
    if (hasTeaser[i] && hasTeaser[j]) return Math.max(fs, (Math.max(ts, fs) + fs) / 2);
    return Math.max(ts, fs);
  };

  const groups = sparseAverageLinkage(toks, minShared, pairScore, threshold).map((g) => g.map((i) => items[i]));

  const clusters: Cluster[] = groups.map((group) => {
    // Prefer an item with real text as the representative.
    const sorted = [...group].sort((a, b) => b.summary.length + b.content.length - (a.summary.length + a.content.length));
    const rep = sorted.find((it) => !isHeadlineOnly(it.kind)) ?? sorted[0];
    // Google News also tells us who else covered the story: that counts as coverage too.
    const outlets = [...new Set([...group.map((it) => it.outlet), ...group.flatMap((it) => it.alsoCoveredBy ?? [])])];
    const latest = Math.max(...group.map((it) => Date.parse(it.publishedAt)));
    const ageHours = Math.max(0, (nowMs - latest) / 3_600_000);
    return {
      id: '',
      items: group,
      outlets,
      topicHints: [...new Set(group.map((it) => it.topicHint))],
      title: rep.title,
      summary: rep.summary || rep.content.slice(0, 300),
      latestAt: new Date(latest).toISOString(),
      // More outlets = more important; newer = slightly better. (scoring.ts ranks properly.)
      score: outlets.length * 3 + Math.max(0, 24 - ageHours) / 12,
    };
  });

  clusters.sort((a, b) => b.score - a.score);
  const picked = diversify(clusters, maxClusters);
  picked.forEach((c, i) => (c.id = `c${i + 1}`));
  return { clusters: picked, total: clusters.length };
}

/**
 * Average-linkage over only the pairs that can possibly match.
 *
 * A pair scores > 0 only if the two items share ≥ `minShared` words, and two
 * groups only ever merge through a pair scoring ≥ `threshold`. So we:
 *  1. find candidate pairs with an inverted index (no n² scan),
 *  2. split items into connected components of the ≥ threshold graph,
 *  3. run the exact average-linkage inside each component.
 * Merges never cross components, so the groups are identical to running it on
 * everything at once, at a tiny fraction of the cost for ~1,500 items.
 */
function sparseAverageLinkage(
  toks: Set<string>[],
  minShared: number,
  pairScore: (i: number, j: number) => number,
  threshold: number,
): number[][] {
  const n = toks.length;
  const postings = new Map<string, number[]>();
  toks.forEach((set, i) => {
    for (const t of set) {
      const list = postings.get(t);
      if (list) list.push(i);
      else postings.set(t, [i]);
    }
  });

  // Union-find over ≥ threshold edges.
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const shared = new Int32Array(n);
  const touched: number[] = [];
  for (let i = 0; i < n; i++) {
    for (const t of toks[i]) {
      for (const j of postings.get(t)!) {
        if (j <= i) continue;
        if (shared[j] === 0) touched.push(j);
        shared[j]++;
      }
    }
    for (const j of touched) {
      // Title words are a subset of all words, so this bounds both overlaps.
      if (shared[j] >= minShared && pairScore(i, j) >= threshold) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
      shared[j] = 0;
    }
    touched.length = 0;
  }

  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = components.get(root);
    if (list) list.push(i);
    else components.set(root, [i]);
  }

  const groups: number[][] = [];
  for (const members of components.values()) {
    if (members.length === 1) {
      groups.push(members);
      continue;
    }
    // members is in ascending index order, like the original full run.
    const local = averageLinkage(members.length, (a, b) => pairScore(members[a], members[b]), threshold);
    for (const g of local) groups.push(g.map((k) => members[k]));
  }
  // Same order as one big run: by each group's smallest index.
  return groups.sort((a, b) => a[0] - b[0]);
}

/**
 * Agglomerative average-linkage: repeatedly merges the two groups that match
 * best as a whole (some pair ≥ threshold, mean of all pairs ≥ 0.75×threshold).
 * Unlike single-linkage this stops chains like
 * "Nobel chemistry" → "Nobel physics" → "Nobel economics predictions",
 * and unlike a greedy pass the result doesn't depend on item order.
 */
function averageLinkage(n: number, pairScore: (i: number, j: number) => number, threshold: number): number[][] {
  const sum: Float64Array[] = [];
  const max: Float64Array[] = [];
  for (let i = 0; i < n; i++) {
    sum.push(new Float64Array(n));
    max.push(new Float64Array(n));
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = pairScore(i, j);
      if (s > 0) sum[i][j] = sum[j][i] = max[i][j] = max[j][i] = s;
    }
  }
  const members: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const alive = new Set(members.keys());
  for (;;) {
    let bestAvg = 0;
    let ba = -1;
    let bb = -1;
    for (const a of alive) {
      for (const b of alive) {
        if (b <= a || max[a][b] < threshold) continue;
        const avg = sum[a][b] / (members[a].length * members[b].length);
        if (avg >= threshold * 0.75 && avg > bestAvg) {
          bestAvg = avg;
          ba = a;
          bb = b;
        }
      }
    }
    if (ba === -1) break;
    for (const c of alive) {
      if (c === ba || c === bb) continue;
      sum[ba][c] = sum[c][ba] = sum[ba][c] + sum[bb][c];
      max[ba][c] = max[c][ba] = Math.max(max[ba][c], max[bb][c]);
    }
    members[ba].push(...members[bb]);
    alive.delete(bb);
  }
  return [...alive].map((g) => members[g]);
}

/**
 * Keeps the best clusters while making sure every topic hint gets a fair share:
 * a small beat (games, cricket) has fewer outlets, so it would otherwise lose
 * every slot to the general news.
 */
function diversify(clusters: Cluster[], max: number): Cluster[] {
  if (clusters.length <= max) return clusters;
  const perHint = Math.floor(max / (ALL_HINTS.length * 2));
  const chosen = new Set<Cluster>();
  for (const hint of ALL_HINTS) {
    clusters.filter((c) => c.topicHints.includes(hint)).slice(0, perHint).forEach((c) => chosen.add(c));
  }
  for (const c of clusters) {
    if (chosen.size >= max) break;
    chosen.add(c);
  }
  return clusters.filter((c) => chosen.has(c));
}

/** Normalized content words of a text (also used by scoring and the daytime check). */
export function storyTokens(text: string): Set<string> {
  return normTokens(text);
}

/**
 * Plain overlap between two word sets: shared / smaller set, or 0 when fewer
 * than `minShared` words are shared. Good enough to ask "same event?" across days.
 */
export function overlap(a: Set<string>, b: Set<string>, minShared = 3): number {
  let shared = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) shared++;
  return shared >= minShared && small.size ? shared / small.size : 0;
}

/** For tests: the sparse grouping must match the plain all-pairs version exactly. */
export { averageLinkage as _averageLinkage, sparseAverageLinkage as _sparseAverageLinkage };
