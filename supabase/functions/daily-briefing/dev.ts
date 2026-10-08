// Local smoke test of the real network path, no database and no AI:
//   npx --yes deno@latest run -A supabase/functions/daily-briefing/dev.ts [--articles]
//
// Prints feed health, items per category/outlet, grouping time, the top stories
// with their importance scores (and which are must-include), and markets.
// With --articles it also reads the top stories' article pages.
// Set SEC_CONTACT_EMAIL in your shell to include SEC filings.

import { fetchArticle } from '../_shared/articles.ts';
import { clusterAll } from '../_shared/dedupe.ts';
import { feedHealth, fetchAllFeeds, itemCategory } from '../_shared/feeds.ts';
import { fetchMarkets } from '../_shared/markets.ts';
import { rankClusters } from '../_shared/scoring.ts';
import { SOURCES } from '../_shared/sources.ts';

const now = new Date();
const t0 = Date.now();
const { items, statuses } = await fetchAllFeeds(SOURCES, now);
const t1 = Date.now();

console.log(`\n== Feeds (${t1 - t0} ms, failed ones retried once)`);
for (const s of statuses) {
  const state = s.skipped ? 'skip' : s.ok ? 'ok  ' : 'FAIL';
  console.log(`${state} ${s.sourceId.padEnd(16)} ${s.category.padEnd(10)} ${String(s.items).padStart(4)} items  ${String(s.ms).padStart(5)} ms ${s.retried ? '(retried) ' : ''}${s.error ?? s.skipped ?? ''}`);
}
const health = feedHealth(statuses);
console.log(`\nFeeds ok: ${health.ok}/${health.total} (${Math.round(health.failRate * 100)}% failed${health.failRate > 0.2 ? ' → the morning run would alert' : ''})`);

const perCategory = new Map<string, number>();
const perOutlet = new Map<string, number>();
for (const it of items) {
  perCategory.set(itemCategory(it), (perCategory.get(itemCategory(it)) ?? 0) + 1);
  perOutlet.set(it.outlet, (perOutlet.get(it.outlet) ?? 0) + 1);
}
console.log('Items per category:', Object.fromEntries(perCategory));
console.log('Outlets:', perOutlet.size, '| breaking-flagged:', items.filter((i) => i.breaking).length);
console.log('Total items:', items.length, '| with image:', items.filter((i) => i.imageUrl).length, '| with feed content:', items.filter((i) => i.content.length > 400).length);

const c0 = performance.now();
const { clusters, total } = clusterAll(items, { now });
const c1 = performance.now();
const { ranked, scores } = rankClusters(clusters, { now });
const c2 = performance.now();
const must = ranked.filter((c) => scores.get(c.id)?.mustInclude);
console.log(`\n== Grouping: ${total} stories (${clusters.length} kept) · group ${(c1 - c0).toFixed(0)} ms + score ${(c2 - c1).toFixed(0)} ms · ${must.length} must-include`);
for (const c of ranked.slice(0, 25)) {
  const s = scores.get(c.id)!;
  console.log(`\n[${c.id}] ${s.mustInclude ? 'MUST ' : ''}score ${s.score.toFixed(1)} · ${s.why.join(' · ')}`);
  console.log(`   ${c.outlets.slice(0, 12).join(', ')}${c.outlets.length > 12 ? ', …' : ''}`);
  for (const it of c.items.slice(0, 4)) console.log(`   - (${it.outlet}) ${it.title.slice(0, 110)}`);
}

console.log('\n== Markets');
console.log(await fetchMarkets());

if (Deno.args.includes('--articles')) {
  console.log('\n== Article pages (top 8 stories)');
  for (const c of ranked.slice(0, 8)) {
    for (const it of c.items.filter((i) => i.kind !== 'google-news' && i.kind !== 'google-news-topic').slice(0, 2)) {
      const a = await fetchArticle(it.link);
      console.log(`${a.ok ? 'ok  ' : 'none'} ${it.outlet.padEnd(16)} text ${String(a.text.length).padStart(5)} chars · img ${a.ogImage ? 'yes' : 'no '} · ${it.link.slice(0, 80)}`);
      if (a.ok) console.log(`      “${a.text.slice(0, 160)}…”`);
    }
  }
}
