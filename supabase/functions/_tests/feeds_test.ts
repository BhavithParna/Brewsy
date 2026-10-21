import { assert, assertEquals } from 'jsr:@std/assert@1';

import { extractArticle } from '../_shared/articles.ts';
import {
  breakingFlag, cleanImageUrl, feedHealth, fetchAllFeeds, type FeedStatus, isGossip, isHeadlineOnly, isJunk, itemCategory, narrowerHint, parseAnthropicNews,
  parseFeedXml, parseNewsSitemap, parseSec8k, trimHugeFeed,
} from '../_shared/feeds.ts';
import { type FeedSource, isMajorOutlet, normalizeOutlet, SOURCE_GROUPS, SOURCES } from '../_shared/sources.ts';

const NOW = new Date('2026-10-07T12:00:00Z');
const src = (over: Partial<FeedSource> = {}): FeedSource => ({ id: 'bbc-tech', outlet: 'BBC News', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: 'https://x', ...over });

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title><![CDATA[Finland orders halt to work on two Google data centres]]></title>
    <link>https://www.bbc.co.uk/news/articles/abc?at_medium=RSS&amp;at_campaign=rss</link>
    <description>The order follows concerns over &amp; forest clearance.</description>
    <pubDate>Wed, 07 Oct 2026 09:10:00 GMT</pubDate>
    <media:thumbnail width="240" url="https://ichef.bbci.co.uk/ace/branded_news/240/a.jpg"/>
    <media:thumbnail width="1200" url="https://ichef.bbci.co.uk/ace/branded_news/1200/a.jpg"/>
  </item>
  <item>
    <title>Old story</title><link>https://x/old</link><pubDate>Sun, 04 Oct 2026 09:10:00 GMT</pubDate>
  </item>
  <item>
    <title>Save up to 44% on the best Prime Day deals</title><link>https://x/deal</link><pubDate>Wed, 07 Oct 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Hackers obtain counterfeit TLS certificates</title><link>https://arstechnica.com/x</link>
    <pubDate>Wed, 07 Oct 2026 06:00:00 +0000</pubDate>
    <content:encoded><![CDATA[<p>Attackers hijacked three top-level domains.</p><img src="https://cdn.arstechnica.net/a.jpg">]]></content:encoded>
  </item>
</channel></rss>`;

Deno.test('RSS: window, junk filter, entities, largest thumbnail, BBC unbranded image, tracking params', () => {
  const items = parseFeedXml(RSS, src(), NOW);
  assertEquals(items.map((i) => i.title), ['Finland orders halt to work on two Google data centres', 'Hackers obtain counterfeit TLS certificates']);
  const [bbc, ars] = items;
  assertEquals(bbc.link, 'https://www.bbc.co.uk/news/articles/abc');
  assertEquals(bbc.summary, 'The order follows concerns over & forest clearance.');
  assertEquals(bbc.imageUrl, 'https://ichef.bbci.co.uk/ace/standard/1200/a.jpg');
  assertEquals(ars.content, 'Attackers hijacked three top-level domains.');
  assertEquals(ars.imageUrl, 'https://cdn.arstechnica.net/a.jpg');
  assertEquals(bbc.outlet, 'BBC News');
});

Deno.test('Atom entries (e.g. The Verge)', () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title type="html">Ring’s first smart lock can be charged by turning a dial</title>
      <link rel="alternate" type="text/html" href="https://www.theverge.com/tech/1"/>
      <published>2026-10-07T11:00:00-04:00</published>
      <summary type="html">&lt;p&gt;Amazon’s Ring is entering locks.&lt;/p&gt;</summary></entry>
  </feed>`;
  const [e] = parseFeedXml(atom, src({ id: 'verge', outlet: 'The Verge' }), new Date('2026-10-07T16:00:00Z'));
  assertEquals(e.title, 'Ring’s first smart lock can be charged by turning a dial');
  assertEquals(e.link, 'https://www.theverge.com/tech/1');
  assertEquals(e.summary, 'Amazon’s Ring is entering locks.');
});

Deno.test('Google News: outlet suffix stripped, no teaser, capped item count', () => {
  const items = Array.from({ length: 60 }, (_, i) =>
    `<item><title>Story ${i} about markets - Reuters</title><link>https://news.google.com/rss/articles/${i}</link>
     <pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Story&lt;/a&gt;</description><source url="https://www.reuters.com">Reuters</source></item>`).join('');
  const out = parseFeedXml(`<rss><channel>${items}</channel></rss>`, src({ id: 'reuters', outlet: 'Reuters', kind: 'google-news', topicHint: 'mixed' }), NOW);
  assertEquals(out.length, 40);
  assertEquals(out[0].title, 'Story 0 about markets');
  assertEquals(out[0].summary, '');
});

Deno.test('Anthropic news page: date + title from link text, 36h window', () => {
  const html = `
    <a href="/news/cyber-verification-program"><span>Announcements</span><span>Oct 6, 2026</span><h3>Expanding the Cyber Verification Program</h3><p>We’re launching a new, expanded version of our Cyber Verification Program for defenders.</p></a>
    <a href="/news/cyber-verification-program"><span>Oct 6, 2026</span></a>
    <a href="/news/barclays-scales-claude"><span>Oct 1, 2026</span><span>Announcements</span><h3>Barclays scales Claude to upgrade operations</h3></a>`;
  const out = parseAnthropicNews(html, src({ id: 'anthropic', outlet: 'Anthropic', kind: 'html-list', topicHint: 'ai', url: 'https://www.anthropic.com/news' }), NOW);
  assertEquals(out.length, 1);
  assertEquals(out[0].title, 'Expanding the Cyber Verification Program');
  assertEquals(out[0].link, 'https://www.anthropic.com/news/cyber-verification-program');
  assert(out[0].summary.startsWith('We’re launching'));
});

Deno.test('trimHugeFeed keeps valid XML with the first N items', () => {
  const big = `<rss><channel>${'<item><title>x</title><link>y</link></item>'.repeat(50)}${' '.repeat(400_000)}</channel></rss>`;
  const cut = trimHugeFeed(big, 10, 1000);
  assertEquals((cut.match(/<\/item>/g) ?? []).length, 10);
  assert(cut.endsWith('</channel></rss>'));
});

Deno.test('junk + image cleanup', () => {
  assert(isJunk('The Download: weight-loss drugs and batteries'));
  assert(isJunk('S&P 500 record, ICE’s economic chill and more in Morning Squawk'));
  assert(!isJunk('Finland orders halt to work on two Google data centres'));
  // Shopping roundups are junk; a deal in the news is not (headlines from 11 Oct 2026 feeds).
  for (const t of ['38 Best Last-Minute Prime Day Deals You Can Still Shop Today (2026)', 'Lowe’s Promo Codes and Deals: Up to $300 Off Appliances',
    'Extended Fall Green Deals: EVs, power stations, electric tools', 'Deal of the day: noise-cancelling headphones']) assert(isJunk(t), t);
  for (const t of ['Trump Strikes Deal With Putin for Russian Diesel', 'China agrees to ‘halve’ hybrid car exports to EU in landmark deal',
    'Emmy Awards Move to Prime Video in Six-Year Deal With Amazon', 'Biotech IPOs Charge Ahead as Tech Deals Stall']) assert(!isJunk(t), t);
  assertEquals(cleanImageUrl('http://insecure/x.jpg'), null);
  assertEquals(cleanImageUrl('https://x.com/static/logo.png'), null);
  assertEquals(cleanImageUrl('/img/a.jpg', 'https://site.com/news/1'), 'https://site.com/img/a.jpg');
});

Deno.test('article extraction skips navigation, paywall and cookie text', () => {
  const html = `<html><head><meta property="og:image" content="https://cdn.x.com/hero.jpg"><meta property="og:title" content="T"></head><body>
    <p>BBC HomepageSkip to contentAccessibility HelpYour accountHomeNewsSportEarthReelWorklifeTravel</p>
    <p>Then Rs4499 per month. Complete digital access with exclusive insights. Cancel anytime during your trial.</p>
    <p>Finnish authorities have ordered a halt to building work at two planned Google data centres amid concerns.</p>
    <p>We use cookies to give you the best experience on our website, see our cookie policy for details.</p>
    <p>The sites form part of Google's record €13bn investment in Finland, announced less than a month ago.</p>
  </body></html>`;
  const a = extractArticle(html, 'https://www.bbc.co.uk/news/articles/x');
  assertEquals(a.ogImage, 'https://cdn.x.com/hero.jpg');
  assertEquals(a.text.split('\n\n').length, 2);
  assert(a.text.startsWith('Finnish authorities'));
});

// ─── Wider net: Google News topic pages, SEC filings, breaking flags, retries ───

const topicItem = (title: string, publisher: string, related: string[]) => `<item>
  <title>${title} - ${publisher}</title>
  <link>https://news.google.com/rss/articles/${encodeURIComponent(title)}</link>
  <pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate>
  <description>${[publisher, ...related].map((o) => `&lt;li&gt;&lt;a href="https://news.google.com/x" target="_blank"&gt;${title}&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;${o}&lt;/font&gt;&lt;/li&gt;`).join('')}</description>
  <source url="https://example.com">${publisher}</source>
</item>`;

Deno.test('Google News topic page: credits the real publisher and counts related coverage', () => {
  const xml = `<rss><channel>${topicItem('Fed holds rates steady as inflation cools', 'Reuters', ['CNBC', 'The New York Times', 'Reuters'])}</channel></rss>`;
  const [it] = parseFeedXml(xml, src({ id: 'gn-business', outlet: 'Google News', kind: 'google-news-topic', topicHint: 'business', category: 'safety-net', trust: 'low' }), NOW);
  assertEquals(it.title, 'Fed holds rates steady as inflation cools');
  assertEquals(it.outlet, 'Reuters');
  assertEquals(itemCategory(it), 'wire');
  assertEquals(it.trust, 'high');
  assertEquals(it.alsoCoveredBy, ['CNBC', normalizeOutlet('The New York Times')]);
  assertEquals(it.summary, '');
});

Deno.test('breaking flag: detected and stripped; ordinary headlines untouched', () => {
  assertEquals(breakingFlag('BREAKING: Central bank chief resigns'), { title: 'Central bank chief resigns', breaking: true });
  assertEquals(breakingFlag('Breaking news - quake hits Chile'), { title: 'quake hits Chile', breaking: true });
  assertEquals(breakingFlag('Record-breaking heat in Spain'), { title: 'Record-breaking heat in Spain', breaking: false });
  const xml = `<rss><channel><item><title>BREAKING: Central bank chief resigns</title><link>https://apnews.com/a</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const [it] = parseFeedXml(xml, src({ id: 'ap', outlet: 'Associated Press', category: 'wire' }), NOW);
  assertEquals([it.title, it.breaking, it.category], ['Central bank chief resigns', true, 'wire']);
});

const SEC_ATOM = `<?xml version="1.0" encoding="ISO-8859-1" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
  <content type="text/xml"><filing-date>2026-10-07</filing-date><filing-type>8-K</filing-type><items-desc>items 2.02 and 9.01</items-desc></content>
  <link href="https://www.sec.gov/Archives/edgar/data/320193/000032019326000090/0000320193-26-000090-index.htm" rel="alternate" type="text/html"/>
  <summary type="html"> &lt;b&gt;Filed:&lt;/b&gt; 2026-10-07 &lt;b&gt;AccNo:&lt;/b&gt; 0000320193-26-000090 &lt;b&gt;Size:&lt;/b&gt; 1 MB&lt;br&gt;Item 2.02: Results of Operations and Financial Condition&lt;br&gt;Item 9.01: Financial Statements and Exhibits</summary>
  <title>8-K  - Current report</title>
  <updated>2026-10-07T08:30:12-04:00</updated>
</entry>
<entry>
  <content type="text/xml"><filing-date>2026-10-07</filing-date><items-desc>items 9.01</items-desc></content>
  <link href="https://www.sec.gov/exhibits-only" rel="alternate" type="text/html"/>
  <summary type="html">Item 9.01: Financial Statements and Exhibits</summary>
  <updated>2026-10-07T09:00:00-04:00</updated>
</entry>
<entry>
  <content type="text/xml"><items-desc>items 5.02</items-desc></content>
  <link href="https://www.sec.gov/old" rel="alternate" type="text/html"/>
  <summary type="html">Item 5.02: Departure of Directors</summary>
  <updated>2026-09-01T09:00:00-04:00</updated>
</entry>
</feed>`;

Deno.test('SEC 8-K: plain-words title from item numbers; exhibits-only and old filings skipped', () => {
  const sec = SOURCES.find((s) => s.kind === 'sec-8k')!;
  const out = parseSec8k(SEC_ATOM, sec, { cik: '0000320193', name: 'Apple' }, NOW);
  assertEquals(out.length, 1);
  assertEquals(out[0].title, 'Apple files 8-K: quarterly results (earnings)');
  assert(out[0].link.includes('0000320193-26-000090'));
  assertEquals([out[0].category, out[0].topicHint], ['official', 'business']);
});

Deno.test('sources: every category has a group; wires and majors count as major; plain data', () => {
  assertEquals(SOURCE_GROUPS.map((g) => g.category), ['wire', 'major', 'tech', 'specialist', 'official', 'safety-net']);
  assert(SOURCES.every((s) => s.category && s.trust && s.url));
  assertEquals(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length, 'ids are unique');
  assert(isMajorOutlet('Reuters') && isMajorOutlet('BBC News') && isMajorOutlet('CNN'));
  assert(!isMajorOutlet('Hacker News') && !isMajorOutlet('Some Blog'));
});

Deno.test('fetchAllFeeds: retries a failed feed once; SEC skipped (not failed) without a contact email', async () => {
  const original = globalThis.fetch;
  const hits: Record<string, number> = {};
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    hits[url] = (hits[url] ?? 0) + 1;
    if (url === 'https://flaky.example/rss' && hits[url] === 1) return Promise.resolve(new Response('busy', { status: 503 }));
    if (url === 'https://down.example/rss') return Promise.resolve(new Response('gone', { status: 500 }));
    return Promise.resolve(new Response(`<rss><channel><item><title>Story from ${url}</title><link>${url}/a</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`));
  }) as typeof fetch;
  try {
    const sec = SOURCES.find((s) => s.kind === 'sec-8k')!;
    const { items, statuses } = await fetchAllFeeds([
      src({ id: 'ok', url: 'https://ok.example/rss' }),
      src({ id: 'flaky', url: 'https://flaky.example/rss' }),
      src({ id: 'down', url: 'https://down.example/rss' }),
      sec,
    ], NOW, 24, { secContact: null, retryDelayMs: 1 });
    const by = (id: string) => statuses.find((s) => s.sourceId === id)!;
    assert(by('ok').ok && !by('ok').retried);
    assert(by('flaky').ok && by('flaky').retried);
    assert(!by('down').ok && by('down').retried);
    assert(by('sec-8k').skipped && !by('sec-8k').ok);
    assertEquals(hits['https://down.example/rss'], 2);
    assertEquals(items.length, 2);
    const health = feedHealth(statuses);
    assertEquals([health.ok, health.total, health.failed], [2, 3, ['down']]);
    assertEquals(Math.round(health.failRate * 100), 33);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test('one article in two feeds of an outlet: kept once, with the narrower topic hint (Variety Film over Variety, Guardian Oceans over Environment)', async () => {
  const original = globalThis.fetch;
  const body = (extra: string) => `<rss><channel><item><title>Studio dates its space epic for next summer</title><link>https://variety.example/epic</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate>${extra}</item></channel></rss>`;
  globalThis.fetch = ((input: string | URL | Request) =>
    Promise.resolve(new Response(String(input).includes('film') ? body('') : body('<content:encoded>Longer text from the main feed.</content:encoded>')))) as typeof fetch;
  try {
    const { items } = await fetchAllFeeds([
      src({ id: 'variety', outlet: 'Variety', topicHint: 'entertainment', category: 'specialist', trust: 'medium', url: 'https://variety.example/feed' }),
      src({ id: 'variety-film', outlet: 'Variety', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://variety.example/film/feed' }),
    ], NOW, 24, { secContact: null, retryDelayMs: 1 });
    assertEquals(items.length, 1);
    assertEquals(items[0].topicHint, 'movies');
  } finally {
    globalThis.fetch = original;
  }
  // The Guardian's environment feed often carries the fuller copy; its ocean desk's hint still wins.
  globalThis.fetch = ((input: string | URL | Request) =>
    Promise.resolve(new Response(String(input).includes('oceans') ? body('') : body('<content:encoded>Longer text from the environment feed.</content:encoded>')))) as typeof fetch;
  try {
    const { items } = await fetchAllFeeds([
      src({ id: 'guardian-environment', outlet: 'The Guardian', topicHint: 'climate', category: 'major', trust: 'high', url: 'https://guardian.example/environment/rss' }),
      src({ id: 'guardian-oceans', outlet: 'The Guardian', topicHint: 'oceans', category: 'major', trust: 'high', url: 'https://guardian.example/environment/oceans/rss' }),
    ], NOW, 24, { secContact: null, retryDelayMs: 1 });
    assertEquals(items.length, 1);
    assertEquals(items[0].topicHint, 'oceans');
    assert(items[0].content.includes('environment feed'), 'the richer copy is the one kept');
  } finally {
    globalThis.fetch = original;
  }
  assertEquals(narrowerHint('mixed', 'world'), 'world');
  assertEquals(narrowerHint('movies', 'entertainment'), 'movies');
  assertEquals(narrowerHint('climate', 'oceans'), 'oceans', 'Guardian Oceans over Guardian Environment');
  assertEquals(narrowerHint('science', 'oceans'), 'oceans');
  assertEquals(narrowerHint('oceans', 'climate'), 'oceans');
  assertEquals(narrowerHint('world', 'oceans'), 'world', 'only the science and environment feeds give way');
  assertEquals(narrowerHint('tech', 'ai'), 'tech', 'otherwise the richer copy keeps its own hint');
});

Deno.test('gossip from film and entertainment desks is dropped; film news and other beats are not', () => {
  assert(isGossip('Pregnant Kiara Advani lounges on the beach, clicks family photos', 'movies'));
  assert(isGossip('Nushrratt Bharuccha shares first post since Bali accident', 'movies'));
  assert(isGossip('Star stuns in a sheer gown at the gala', 'entertainment'));
  assert(!isGossip('Ramayana makers announce worldwide release of Part 1 on November 5', 'movies'));
  assert(!isGossip('Drishyam 3 box office collection day 9: crosses ₹150 crore', 'movies'));
  assert(!isGossip('Studio shares first trailer for its animated musical', 'movies'));
  assert(!isGossip('Pregnant women should get the RSV vaccine, panel says', 'health'), 'only film and entertainment feeds');
  assert(!isGossip('Orca pod spotted off the coast for the first time in decades', 'oceans'));
  const xml = `<rss><channel>
    <item><title>Pregnant star lounges on the beach</title><link>https://film.example/1</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate></item>
    <item><title>Telugu period drama crosses 300 crore worldwide</title><link>https://film.example/2</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`;
  assertEquals(parseFeedXml(xml, src({ topicHint: 'movies', category: 'specialist' }), NOW).map((it) => it.title), ['Telugu period drama crosses 300 crore worldwide']);
});

Deno.test('feedHealth ignores skipped feeds', () => {
  const st = (id: string, ok: boolean, skipped?: string): FeedStatus => ({ sourceId: id, outlet: id, category: 'major', ok, items: 0, ms: 0, ...(skipped ? { skipped } : {}) });
  assertEquals(feedHealth([st('a', true), st('b', false, 'no key'), st('c', false)]).failRate, 0.5);
  assertEquals(feedHealth([]).failRate, 0);
});

Deno.test('news sitemap (Reuters): English headlines in the window; reports the oldest date for paging', () => {
  const url = (loc: string, date: string, title: string) =>
    `<url><loc>${loc}</loc><news:news><news:publication><news:name>Reuters</news:name><news:language>en</news:language></news:publication>` +
    `<news:publication_date>${date}</news:publication_date><news:title><![CDATA[${title}]]></news:title></news:news></url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">` +
    url('https://www.reuters.com/world/europe/eu-agrees-tariffs-2026-10-07/', '2026-10-07T11:00:00Z', 'EU agrees tariffs on Chinese steel &amp; aluminium') +
    url('https://www.reuters.com/es/negocio/abc-2026-10-07/', '2026-10-07T10:00:00Z', 'Titular en español') +
    url('https://www.reuters.com/pictures/day-in-pictures-2026-10-07/', '2026-10-07T09:00:00Z', 'Pictures of the day') +
    url('https://www.reuters.com/markets/old-2026-10-05/', '2026-10-05T09:00:00Z', 'Too old') +
    `</urlset>`;
  const source = src({ id: 'reuters', outlet: 'Reuters', kind: 'news-sitemap', category: 'wire', topicHint: 'mixed' });
  const { items, oldestMs, count } = parseNewsSitemap(xml, source, NOW);
  assertEquals(count, 4);
  assertEquals(items.map((i) => i.title), ['EU agrees tariffs on Chinese steel & aluminium']);
  assertEquals(items[0].outlet, 'Reuters');
  assertEquals(items[0].category, 'wire');
  assertEquals(oldestMs, Date.parse('2026-10-05T09:00:00Z'));
  assert(isHeadlineOnly('news-sitemap'));
  assert(!isHeadlineOnly('aggregator'));
});

Deno.test('aggregator (Yahoo News): each item is credited to the outlet that wrote it', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Texas executes man]]></title><link><![CDATA[https://www.yahoo.com/news/us/articles/texas-1]]></link>
      <pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[The execution was the first since…]]></description>
      <source><![CDATA[Associated Press]]></source></item>
    <item><title>Hurricane strengthens</title><link>https://www.yahoo.com/news/weather-2</link>
      <pubDate>Wed, 07 Oct 2026 09:00:00 GMT</pubDate><source><![CDATA[Yahoo News]]></source></item>
  </channel></rss>`;
  const source = src({ id: 'yahoo', outlet: 'Yahoo News', kind: 'aggregator', category: 'safety-net', trust: 'low', topicHint: 'mixed' });
  const [ap, own] = parseFeedXml(xml, source, NOW);
  assertEquals(ap.outlet, 'AP News');
  assertEquals(ap.category, 'wire');
  assertEquals(ap.trust, 'high');
  assertEquals(ap.summary, 'The execution was the first since…');
  assertEquals(own.outlet, 'Yahoo News');
  assertEquals(own.category, 'safety-net');
  assert(isMajorOutlet('AFP'));
});
