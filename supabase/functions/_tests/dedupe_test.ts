import { assert, assertEquals } from 'jsr:@std/assert@1';

import { _averageLinkage, _sparseAverageLinkage, type Cluster, clusterAll, clusterItems, MAX_CLUSTERS } from '../_shared/dedupe.ts';
import type { FeedItem } from '../_shared/feeds.ts';
import { NOW, sampleItems } from './fixtures.ts';

const clusterOf = (clusters: Cluster[], needle: string | RegExp) =>
  clusters.find((c) => c.items.some((i) => (typeof needle === 'string' ? i.title.includes(needle) : needle.test(i.title))))!;
const titles = (c: Cluster) => c.items.map((i) => i.title).join(' | ');

// ─── Small hand-made set: claims that hold regardless of corpus size ───

Deno.test('same event from two outlets becomes one cluster (centre/center spelling too)', () => {
  const clusters = clusterItems(sampleItems(), { now: NOW });
  assertEquals(clusterOf(clusters, 'Finland orders halt').outlets.sort(), ['BBC News', 'CNBC']);
  assertEquals(clusterOf(clusters, '10-year Treasury').outlets.sort(), ['CNBC', 'Financial Times']);
});

Deno.test('different Nobel prizes never share a cluster', () => {
  const clusters = clusterItems(sampleItems(), { now: NOW });
  for (const c of clusters) {
    const kinds = new Set(c.items.map((i) => (/chemistry/i.test(i.title) ? 'chem' : /physic/i.test(i.title) ? 'phys' : /economics/i.test(i.title) ? 'econ' : 'other')));
    kinds.delete('other');
    assert(kinds.size <= 1, `mixed Nobel cluster: ${titles(c)}`);
  }
});

Deno.test('unrelated stories stay separate; multi-outlet clusters rank first; ids are sequential', () => {
  const clusters = clusterItems(sampleItems(), { now: NOW });
  for (const t of ['counterfeit TLS', 'watermark ChatGPT', 'Kenya', 'Mistral']) assertEquals(clusterOf(clusters, t).items.length, 1, t);
  assert(clusters[0].outlets.length > 1);
  assertEquals(clusters.map((c) => c.id), clusters.map((_, i) => `c${i + 1}`));
});

Deno.test('maxClusters caps the list', () => {
  assertEquals(clusterItems(sampleItems(), { now: NOW, maxClusters: 4 }).length, 4);
});

// ─── Real feeds captured on 7 Oct 2026 (227 items, 19 sources) ───

const snapshot = JSON.parse(await Deno.readTextFile(new URL('./fixtures/feeds-2026-10-07.json', import.meta.url))) as { capturedAt: string; items: FeedItem[] };
const snapNow = new Date(snapshot.capturedAt);

Deno.test('real feeds: known same-event pairs merge', () => {
  const clusters = clusterItems(snapshot.items, { now: snapNow });
  assertEquals(clusterOf(clusters, /^Chemistry Nobel awarded/).outlets.sort(), ['BBC News', 'Reuters']);
  assertEquals(clusterOf(clusters, /^Neutrino physicist/).outlets.sort(), ['AP News', 'Ars Technica']);
  assertEquals(clusterOf(clusters, /^Finland orders halt/).outlets.sort(), ['BBC News', 'CNBC']);
  assertEquals(clusterOf(clusters, /^Paramount takes over/).outlets.sort(), ['AP News', 'BBC News']);
  assertEquals(clusterOf(clusters, /^Jaguar unveils new electric car/).outlets.sort(), ['BBC News', 'Reuters', 'Wired']);
});

Deno.test('real feeds: a short "who will win the Nobel" headline does not swallow the chemistry winners', () => {
  const clusters = clusterItems(snapshot.items, { now: snapNow });
  const econ = clusterOf(clusters, /^Who will win the 2026 Nobel Prize in economics/);
  assertEquals(econ.items.length, 1, titles(econ));
  const kagan = clusterOf(clusters, /^Henri B\. Kagan/);
  assert(kagan.items.every((i) => /chemistry/i.test(i.title)), titles(kagan));
});

Deno.test('real feeds: headline-only Google News items never become the representative', () => {
  const clusters = clusterItems(snapshot.items, { now: snapNow });
  assertEquals(clusterOf(clusters, /^Chemistry Nobel awarded/).title, "Chemistry Nobel awarded for solving mystery of life's asymmetry");
  for (const c of clusters) {
    if (c.items.some((i) => i.kind !== 'google-news')) assert(!c.items.find((i) => i.title === c.title && i.kind === 'google-news' && c.items.some((o) => o.kind !== 'google-news' && o.summary)), titles(c));
  }
});

Deno.test('real feeds: fast enough for the 2s edge CPU budget', () => {
  const t0 = performance.now();
  const { clusters, total } = clusterAll(snapshot.items, { now: snapNow });
  const ms = performance.now() - t0;
  assertEquals(total, 211); // 227 items → 211 distinct stories
  assertEquals(clusters.length, Math.min(total, MAX_CLUSTERS));
  assert(ms < 500, `clustering took ${ms.toFixed(0)}ms`);
});

Deno.test('scale: 1,500 items group well inside the 2s edge CPU budget', () => {
  // The wider source net brings ~1,000–1,500 items a morning: 7× the snapshot, reworded per copy.
  const big: FeedItem[] = [];
  for (let k = 0; k < 7; k++) {
    for (const it of snapshot.items) big.push({ ...it, id: `${it.id}-${k}`, link: `${it.link}#${k}`, title: k ? `${it.title} (${['update', 'report', 'live', 'latest', 'analysis', 'explainer'][k - 1]})` : it.title });
  }
  const t0 = performance.now();
  const { total } = clusterAll(big, { now: snapNow });
  const ms = performance.now() - t0;
  assert(total >= 150, `only ${total} groups`);
  assert(ms < 1000, `clustering ${big.length} items took ${ms.toFixed(0)}ms`);
});

Deno.test('sparse grouping gives exactly the same groups as the all-pairs version', () => {
  // Random word sets over a small vocabulary: lots of overlap, chains and ties.
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let round = 0; round < 25; round++) {
    const n = 40 + Math.floor(rand() * 60);
    const toks = Array.from({ length: n }, () => new Set(Array.from({ length: 4 + Math.floor(rand() * 6) }, () => `w${Math.floor(rand() * 30)}`)));
    const score = (i: number, j: number) => {
      const shared = [...toks[i]].filter((t) => toks[j].has(t)).length;
      return shared >= 3 ? shared / Math.min(toks[i].size, toks[j].size) : 0;
    };
    const norm = (groups: number[][]) => groups.map((g) => [...g].sort((a, b) => a - b).join(',')).sort();
    assertEquals(norm(_sparseAverageLinkage(toks, 3, score, 0.5)), norm(_averageLinkage(n, score, 0.5)), `round ${round}`);
  }
});
