// Fetches and parses every news source into a flat list of recent items.

import { XMLParser } from 'npm:fast-xml-parser@5.11.2';

import { fetchText, fetchTextResult } from './http.ts';
import { type FeedSource, normalizeOutlet, outletInfo, type SourceCategory, type TopicHint, type Trust } from './sources.ts';
import { htmlToText, oneLine, truncate } from './text.ts';

export type FeedItem = {
  id: string;
  sourceId: string;
  outlet: string;
  kind: FeedSource['kind'];
  topicHint: TopicHint;
  title: string;
  link: string;
  /** Short plain-text teaser (≤ 600 chars). */
  summary: string;
  /** Longer plain text from the feed itself (content:encoded), may be ''. */
  content: string;
  publishedAt: string;
  imageUrl: string | null;
  // The fields below were added with the wider source net. They're optional so
  // older saved items (test fixtures) still load; `itemCategory()` etc. fill gaps.
  /** Category of the outlet this item is credited to. */
  category?: SourceCategory;
  trust?: Trust;
  /** The headline carried a "breaking" flag (e.g. "BREAKING: …"). */
  breaking?: boolean;
  /** Google News topic items: other outlets covering the same story. */
  alsoCoveredBy?: string[];
};

export type FeedStatus = {
  sourceId: string;
  outlet: string;
  category: SourceCategory;
  ok: boolean;
  items: number;
  ms: number;
  error?: string;
  /** Not attempted (e.g. SEC filings without SEC_CONTACT_EMAIL). Not counted as a failure. */
  skipped?: string;
  /** Failed once and was tried again. */
  retried?: boolean;
};

export function itemCategory(item: FeedItem): SourceCategory {
  return item.category ?? outletInfo(item.outlet).category;
}

export function itemTrust(item: FeedItem): Trust {
  return item.trust ?? outletInfo(item.outlet).trust;
}

/** "BREAKING: …" / "Breaking news: …" headlines. Conservative on purpose. */
const BREAKING_RE = /^\s*breaking\b|\bbreaking news\b/i;
const BREAKING_PREFIX_RE = /^\s*breaking(\s+news)?\s*[:\-–—|]\s*/i;

/** Detects the breaking flag and strips it from the headline. */
export function breakingFlag(title: string): { title: string; breaking: boolean } {
  if (!BREAKING_RE.test(title)) return { title, breaking: false };
  return { title: title.replace(BREAKING_PREFIX_RE, '') || title, breaking: true };
}

/**
 * Promos, deal roundups and newsletters that aren't news. Edit freely.
 * Matched against the headline (case-insensitive).
 */
export const JUNK_PATTERNS: RegExp[] = [
  /\bdeals?\b/i,
  /\bprime day\b/i,
  /\b\d+% off\b/i,
  /\bcoupon/i,
  /^support ars\b/i,
  /^the download:/i,
  /morning squawk/i,
  /^tech life$/i,
  /\bdisrupt 20\d\d\b.*\b(save|pass|tickets?|exhibit)\b/i,
  /\b(podcast|newsletter)\b/i,
  /^(quiz|watch|video|listen):/i,
];

export function isJunk(title: string): boolean {
  return JUNK_PATTERNS.some((re) => re.test(title));
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name: string) =>
    ['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure', 'category'].includes(name),
});

// deno-lint-ignore no-explicit-any
type Node = any;

function textOf(node: Node): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (Array.isArray(node)) return textOf(node[0]);
  if (typeof node === 'object') return textOf(node['#text']);
  return '';
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Normalizes known image URL quirks (e.g. BBC's branded variant has a logo strip). */
export function cleanImageUrl(url: string | null | undefined, base?: string): string | null {
  if (!url) return null;
  let u = url.trim();
  try {
    u = new URL(u, base).toString();
  } catch {
    return null;
  }
  if (!u.startsWith('https://')) return null;
  if (/logo|placeholder|default[-_]?(og|share|image)|favicon|sprite/i.test(u)) return null;
  return u.replace('/ace/branded_news/', '/ace/standard/');
}

function firstImgSrc(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** Very large feeds (OpenAI's is ~750 KB) are cut after `maxItems` to save CPU time. */
export function trimHugeFeed(xml: string, maxItems = 40, threshold = 300_000): string {
  if (xml.length < threshold) return xml;
  const isAtom = /<feed[\s>]/.test(xml.slice(0, 2000));
  const close = isAtom ? '</entry>' : '</item>';
  let idx = -1;
  for (let i = 0; i < maxItems; i++) {
    const next = xml.indexOf(close, idx + 1);
    if (next === -1) return xml;
    idx = next;
  }
  return xml.slice(0, idx + close.length) + (isAtom ? '</feed>' : '</channel></rss>');
}

function inWindow(publishedMs: number, nowMs: number, windowHours: number): boolean {
  return publishedMs <= nowMs + 60 * 60 * 1000 && nowMs - publishedMs <= windowHours * 60 * 60 * 1000;
}

type ItemFields = Omit<FeedItem, 'id' | 'sourceId' | 'outlet' | 'kind' | 'topicHint' | 'category' | 'trust' | 'breaking'>;

/**
 * Builds an item credited to `outlet` (defaults to the source's own outlet).
 * Google News topic items are credited to their real publisher, whose
 * category/trust we look up instead of the feed's.
 */
function makeItem(source: FeedSource, fields: ItemFields, outlet = source.outlet): FeedItem {
  const flag = breakingFlag(fields.title);
  const info = outlet === source.outlet ? { category: source.category, trust: source.trust } : outletInfo(outlet);
  return {
    id: `${source.id}-${hash(fields.link || fields.title)}`,
    sourceId: source.id,
    outlet,
    kind: source.kind,
    topicHint: source.topicHint,
    ...fields,
    title: flag.title,
    category: info.category,
    trust: info.trust,
    breaking: flag.breaking,
  };
}

/** Feeds that carry only a headline and a link (no summary or article text). */
export function isHeadlineOnly(kind: FeedSource['kind']): boolean {
  return kind === 'google-news' || kind === 'google-news-topic' || kind === 'news-sitemap';
}

/**
 * Google News search feeds return ~100 headline-only items each; the first 40
 * are plenty and keep dedupe fast. Topic pages hold ~50–70 top stories.
 */
export const GOOGLE_NEWS_MAX_ITEMS = 40;
export const GOOGLE_NEWS_TOPIC_MAX_ITEMS = 60;

/**
 * A Google News topic item's description is a list of the same story at other
 * outlets: `<ol><li><a …>Headline</a>&nbsp;&nbsp;<font …>Outlet</font></li>…</ol>`.
 */
export function relatedOutlets(descriptionHtml: string, own: string): string[] {
  const out = new Set<string>();
  for (const m of descriptionHtml.matchAll(/<font[^>]*>([^<]+)<\/font>/gi)) {
    const name = normalizeOutlet(oneLine(htmlToText(m[1])));
    if (name && name !== own) out.add(name);
  }
  return [...out];
}

/** Parses an RSS 2.0 / RDF / Atom document. Pure; used by tests too. */
export function parseFeedXml(xml: string, source: FeedSource, now: Date, windowHours = 24): FeedItem[] {
  const doc: Node = parser.parse(trimHugeFeed(xml));
  const allRss: Node[] = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item ?? [];
  const rssItems = source.kind === 'google-news'
    ? allRss.slice(0, GOOGLE_NEWS_MAX_ITEMS)
    : source.kind === 'google-news-topic'
      ? allRss.slice(0, GOOGLE_NEWS_TOPIC_MAX_ITEMS)
      : allRss;
  const atomEntries: Node[] = doc?.feed?.entry ?? [];
  const out: FeedItem[] = [];
  const nowMs = now.getTime();

  for (const it of rssItems) {
    let title = oneLine(htmlToText(textOf(it.title)));
    let link = textOf(it.link).trim() || textOf(it.guid).trim();
    const dateStr = textOf(it.pubDate) || textOf(it['dc:date']) || textOf(it.published);
    const published = Date.parse(dateStr);
    if (!title || !link || !Number.isFinite(published) || !inWindow(published, nowMs, windowHours)) continue;

    const descHtml = textOf(it.description);
    const contentHtml = textOf(it['content:encoded']);
    let summary = truncate(oneLine(htmlToText(descHtml)), 600);
    let content = contentHtml ? truncate(htmlToText(contentHtml), 6000) : '';
    let outlet = source.outlet;
    let alsoCoveredBy: string[] | undefined;

    if (source.kind === 'google-news' || source.kind === 'google-news-topic') {
      // "Headline - Reuters" → "Headline"; the description just repeats the title.
      const outletName = oneLine(textOf(it.source)) || source.outlet;
      const escaped = outletName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`\\s+[-–—|]\\s+${escaped}$`, 'i'), '');
      summary = '';
      content = '';
      if (source.kind === 'google-news-topic') {
        // Credit the real publisher, and remember who else covered it.
        outlet = normalizeOutlet(outletName);
        alsoCoveredBy = relatedOutlets(descHtml, outlet);
      }
    }

    if (source.kind === 'aggregator') {
      // Credit the outlet that wrote it (Yahoo News → "Associated Press" → AP News).
      const name = oneLine(htmlToText(textOf(it.source)));
      if (name) outlet = normalizeOutlet(name);
    }

    const media = [...(it['media:content'] ?? []), ...(it['media:thumbnail'] ?? [])]
      .filter((m: Node) => m?.['@_url'] && (!m['@_medium'] || m['@_medium'] === 'image'))
      .sort((a: Node, b: Node) => Number(b['@_width'] ?? 0) - Number(a['@_width'] ?? 0));
    const enclosure = (it.enclosure ?? []).find((e: Node) => String(e?.['@_type'] ?? '').startsWith('image'));
    const img = media[0]?.['@_url'] ?? enclosure?.['@_url'] ?? firstImgSrc(contentHtml) ?? firstImgSrc(descHtml);

    if (isJunk(title)) continue;
    link = link.replace(/[?&]at_(medium|campaign)=[^&]+/g, '').replace(/\?$/, '');
    out.push(makeItem(source, {
      title,
      link,
      summary,
      content,
      publishedAt: new Date(published).toISOString(),
      imageUrl: cleanImageUrl(img, link),
      ...(alsoCoveredBy?.length ? { alsoCoveredBy } : {}),
    }, outlet));
  }

  for (const e of atomEntries) {
    const title = oneLine(htmlToText(textOf(e.title)));
    const links: Node[] = e.link ?? [];
    const alt = links.find((l: Node) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    const link = String(alt?.['@_href'] ?? '').trim();
    const published = Date.parse(textOf(e.published) || textOf(e.updated));
    if (!title || !link || !Number.isFinite(published) || !inWindow(published, nowMs, windowHours)) continue;
    if (isJunk(title)) continue;
    const contentHtml = textOf(e.content);
    const summaryHtml = textOf(e.summary);
    const thumb = (e['media:thumbnail'] ?? [])[0]?.['@_url'] ?? (e['media:content'] ?? [])[0]?.['@_url'];
    out.push(makeItem(source, {
      title,
      link,
      summary: truncate(oneLine(htmlToText(summaryHtml || contentHtml)), 600),
      content: contentHtml ? truncate(htmlToText(contentHtml), 6000) : '',
      publishedAt: new Date(published).toISOString(),
      imageUrl: cleanImageUrl(thumb ?? firstImgSrc(contentHtml) ?? firstImgSrc(summaryHtml), link),
    }));
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const CATEGORY_WORDS = /^(announcements?|product|policy|research|science|news|societal impacts|interpretability|alignment|economic research|company|customers?|events?)$/i;

/**
 * Anthropic has no RSS. Its /news page lists posts as links whose text contains
 * the date ("Oct 6, 2026"), a category and the title. Dates are day-only, so
 * the window is widened to 36 hours.
 */
export function parseAnthropicNews(html: string, source: FeedSource, now: Date): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  const re = /<a[^>]+href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const href = m[1];
    if (seen.has(href)) continue;
    const parts = m[2]
      .split(/<[^>]+>/)
      .map((p) => oneLine(htmlToText(p)))
      .filter(Boolean);
    const dateIdx = parts.findIndex((p) => /^[A-Z][a-z]{2,8} \d{1,2}, \d{4}$/.test(p));
    if (dateIdx === -1) continue;
    const [mon, day, year] = parts[dateIdx].replace(',', '').split(' ');
    const month = MONTHS[mon.slice(0, 3).toLowerCase()];
    if (month === undefined) continue;
    const published = Date.UTC(Number(year), month, Number(day), 12);
    if (!inWindow(published, now.getTime(), 36)) continue;
    const rest = parts.filter((p, i) => i !== dateIdx && !CATEGORY_WORDS.test(p));
    const title = rest.find((p) => p.length >= 12);
    if (!title) continue;
    seen.add(href);
    const summary = rest.find((p) => p !== title && p.length > 40) ?? '';
    out.push(makeItem(source, {
      title,
      link: new URL(href, source.url).toString(),
      summary: truncate(summary, 600),
      content: '',
      publishedAt: new Date(published).toISOString(),
      imageUrl: null,
    }));
  }
  return out;
}

// ─── SEC 8-K filings ────────────────────────────────────────────────────────

/** 8-K item numbers in plain words. 9.01 (exhibits) alone isn't news, so it's left out. */
export const SEC_8K_ITEMS: Record<string, string> = {
  '1.01': 'a major agreement',
  '1.02': 'the end of a major agreement',
  '1.03': 'bankruptcy',
  '1.05': 'a material cybersecurity incident',
  '2.01': 'a completed acquisition or sale',
  '2.02': 'quarterly results (earnings)',
  '2.03': 'major new debt',
  '2.05': 'restructuring or layoff costs',
  '2.06': 'a material impairment',
  '3.01': 'a delisting notice',
  '4.01': 'a change of auditor',
  '4.02': 'restated past results',
  '5.01': 'a change in control',
  '5.02': 'an executive or board change',
  '5.07': 'shareholder vote results',
  '7.01': 'an investor announcement',
  '8.01': 'other important events',
};

/**
 * Parses one company's EDGAR 8-K Atom feed. Item numbers are read from the
 * entry's summary ("Item 2.02: …") or `items-desc` ("items 2.02 and 9.01").
 */
export function parseSec8k(xml: string, source: FeedSource, company: { cik: string; name: string }, now: Date, windowHours = 24): FeedItem[] {
  const doc: Node = parser.parse(xml);
  const entries: Node[] = doc?.feed?.entry ?? [];
  const out: FeedItem[] = [];
  for (const e of entries) {
    const links: Node[] = e.link ?? [];
    const link = String(links[0]?.['@_href'] ?? textOf(e.content?.['filing-href']) ?? '').trim();
    const published = Date.parse(textOf(e.updated) || textOf(e.content?.['filing-date']));
    if (!link || !Number.isFinite(published) || !inWindow(published, now.getTime(), windowHours)) continue;
    const blob = `${htmlToText(textOf(e.summary))} ${textOf(e.content?.['items-desc'])}`;
    const codes = [...new Set([...blob.matchAll(/\b(\d\.\d{2})\b/g)].map((m) => m[1]))].filter((c) => SEC_8K_ITEMS[c]);
    if (!codes.length) continue;
    const what = codes.map((c) => SEC_8K_ITEMS[c]);
    const title = `${company.name} files 8-K: ${what.join(', ')}`;
    out.push(makeItem(source, {
      title,
      link,
      summary: `${company.name} filed a Form 8-K with the SEC reporting ${what.join('; ')}.`,
      content: '',
      publishedAt: new Date(published).toISOString(),
      imageUrl: null,
    }));
  }
  return out;
}

// ─── Fetching ───────────────────────────────────────────────────────────────

export type FetchFeedsOptions = {
  /** Contact e-mail for the SEC's required User-Agent. Without it, SEC sources are skipped. */
  secContact?: string | null;
  /** Wait before retrying failed feeds once. */
  retryDelayMs?: number;
};

type SourceResult = { items: FeedItem[]; status: FeedStatus };

const ACCEPT_FEED = 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*';

async function mapLimit<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    }),
  );
  return out;
}

async function fetchSec(source: FeedSource, now: Date, windowHours: number, contact: string): Promise<SourceResult> {
  const started = Date.now();
  const headers = { 'User-Agent': `Brewsy news reader ${contact}` };
  const companies = source.companies ?? [];
  // The SEC allows 10 requests a second; 4 at a time stays well under it.
  const results = await mapLimit(companies, 4, async (company) => {
    const xml = await fetchText(source.url.replace('{cik}', company.cik), 12_000, 'application/atom+xml, application/xml, */*', headers);
    if (xml == null) return null;
    try {
      return parseSec8k(xml, source, company, now, windowHours);
    } catch {
      return null;
    }
  });
  const answered = results.filter((r) => r !== null);
  const items = answered.flat() as FeedItem[];
  const ok = answered.length >= Math.ceil(companies.length / 2);
  return {
    items,
    status: {
      sourceId: source.id, outlet: source.outlet, category: source.category, ok, items: items.length, ms: Date.now() - started,
      ...(ok ? {} : { error: `only ${answered.length}/${companies.length} company feeds answered` }),
    },
  };
}

/** Sitemap pages fetched at most (Reuters lists ~50 articles an hour per page). */
export const SITEMAP_MAX_PAGES = 30;
/** Path prefixes of non-English editions in Reuters' sitemap (/es/, /fr/, …) and non-articles. */
const SITEMAP_SKIP_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?|pictures|video|podcasts|graphics)\//i;

/**
 * Parses one page of a Google-News-style sitemap (<url><loc>…<news:title>…).
 * Pure; used by tests too. `oldestMs` tells the caller whether to fetch the next page.
 */
export function parseNewsSitemap(xml: string, source: FeedSource, now: Date, windowHours = 24): { items: FeedItem[]; oldestMs: number | null; count: number } {
  const items: FeedItem[] = [];
  let oldestMs: number | null = null;
  let count = 0;
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    count++;
    const block = m[1];
    const link = htmlToText(block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? '').trim();
    const rawTitle = block.match(/<news:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/news:title>/)?.[1] ?? '';
    const published = Date.parse(block.match(/<news:publication_date>([^<]+)</)?.[1] ?? '');
    if (Number.isFinite(published)) oldestMs = oldestMs == null ? published : Math.min(oldestMs, published);
    const title = oneLine(htmlToText(rawTitle));
    if (!title || !link || !Number.isFinite(published) || !inWindow(published, now.getTime(), windowHours)) continue;
    let path = '';
    try {
      path = new URL(link).pathname;
    } catch {
      continue;
    }
    if (SITEMAP_SKIP_PATH.test(path) || isJunk(title)) continue;
    items.push(makeItem(source, { title, link, summary: '', content: '', publishedAt: new Date(published).toISOString(), imageUrl: null }));
  }
  return { items, oldestMs, count };
}

/** Pages back through a news sitemap (&from=0, 50, 100…) until the window is covered. */
async function fetchSitemap(source: FeedSource, now: Date, windowHours: number): Promise<SourceResult> {
  const started = Date.now();
  const base = { sourceId: source.id, outlet: source.outlet, category: source.category };
  const cutoff = now.getTime() - windowHours * 3_600_000;
  const items: FeedItem[] = [];
  const PAGE = 50;
  const BATCH = 4;
  let firstError: string | null = null;
  let pages = 0;
  for (let page = 0; page < SITEMAP_MAX_PAGES; page += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, SITEMAP_MAX_PAGES - page) }, (_, k) => page + k);
    const results = await Promise.all(batch.map((p) => fetchTextResult(`${source.url}&from=${p * PAGE}`, 12_000, ACCEPT_FEED)));
    let reachedEnd = false;
    for (const r of results) {
      if ('error' in r) {
        firstError ??= r.error;
        reachedEnd = true;
        continue;
      }
      pages++;
      const parsed = parseNewsSitemap(r.text, source, now, windowHours);
      items.push(...parsed.items);
      if (parsed.count === 0 || (parsed.oldestMs != null && parsed.oldestMs < cutoff)) reachedEnd = true;
    }
    if (reachedEnd) break;
  }
  if (!pages) return { items: [], status: { ...base, ok: false, items: 0, ms: Date.now() - started, error: firstError ?? 'no pages' } };
  return { items, status: { ...base, ok: true, items: items.length, ms: Date.now() - started } };
}

async function fetchOne(source: FeedSource, now: Date, windowHours: number, opts: FetchFeedsOptions): Promise<SourceResult> {
  const started = Date.now();
  const base = { sourceId: source.id, outlet: source.outlet, category: source.category };
  if (source.kind === 'sec-8k') {
    if (!opts.secContact) {
      return { items: [], status: { ...base, ok: false, items: 0, ms: 0, skipped: 'set the SEC_CONTACT_EMAIL secret to read SEC filings' } };
    }
    return fetchSec(source, now, windowHours, opts.secContact);
  }
  if (source.kind === 'news-sitemap') return fetchSitemap(source, now, windowHours);
  const res = await fetchTextResult(source.url, 15_000, source.kind === 'html-list' ? 'text/html' : ACCEPT_FEED);
  if ('error' in res) return { items: [], status: { ...base, ok: false, items: 0, ms: Date.now() - started, error: res.error } };
  const body = res.text;
  try {
    const items = source.kind === 'html-list' ? parseAnthropicNews(body, source, now) : parseFeedXml(body, source, now, windowHours);
    return { items, status: { ...base, ok: true, items: items.length, ms: Date.now() - started } };
  } catch (e) {
    return { items: [], status: { ...base, ok: false, items: 0, ms: Date.now() - started, error: `parse failed: ${String(e).slice(0, 120)}` } };
  }
}

/**
 * Fetches every enabled source in parallel, then tries each failed one once
 * more. Never throws; failures are reported in `statuses`.
 */
export async function fetchAllFeeds(
  sources: FeedSource[],
  now: Date,
  windowHours = 24,
  opts: FetchFeedsOptions = { secContact: Deno.env.get('SEC_CONTACT_EMAIL')?.trim() || null },
): Promise<{ items: FeedItem[]; statuses: FeedStatus[] }> {
  const results = await Promise.all(sources.map((s) => fetchOne(s, now, windowHours, opts)));

  const failed = results.map((r, i) => (!r.status.ok && !r.status.skipped ? i : -1)).filter((i) => i >= 0);
  if (failed.length) {
    await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 1500));
    const again = await Promise.all(failed.map((i) => fetchOne(sources[i], now, windowHours, opts)));
    failed.forEach((i, k) => (results[i] = { ...again[k], status: { ...again[k].status, retried: true } }));
  }

  // The same article often appears in two feeds of one outlet (e.g. CNBC Top + CNBC Tech).
  const byKey = new Map<string, FeedItem>();
  for (const item of results.flatMap((r) => r.items)) {
    const key = `${item.outlet}|${isHeadlineOnly(item.kind) ? item.title.toLowerCase() : item.link.split('#')[0]}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      continue;
    }
    // Keep the richer copy, but don't lose a breaking flag or related coverage.
    const keep = item.content.length > prev.content.length ? item : prev;
    const other = keep === item ? prev : item;
    const related = [...new Set([...(keep.alsoCoveredBy ?? []), ...(other.alsoCoveredBy ?? [])])];
    byKey.set(key, {
      ...keep,
      breaking: Boolean(keep.breaking || other.breaking),
      ...(related.length ? { alsoCoveredBy: related } : {}),
    });
  }
  return { items: [...byKey.values()], statuses: results.map((r) => r.status) };
}

/** Feed health for "How this briefing was made" and the >20% failure alert. */
export function feedHealth(statuses: FeedStatus[]): { ok: number; total: number; failed: string[]; failRate: number } {
  const tried = statuses.filter((s) => !s.skipped);
  const failed = tried.filter((s) => !s.ok).map((s) => s.sourceId);
  return { ok: tried.length - failed.length, total: tried.length, failed, failRate: tried.length ? failed.length / tried.length : 0 };
}
