// Reads an article page for its og:image and main paragraphs.

import { cleanImageUrl } from './feeds.ts';
import { fetchText } from './http.ts';
import { decodeEntities, htmlToText, oneLine, truncate } from './text.ts';

export type ArticleText = {
  ok: boolean;
  ogImage: string | null;
  title: string | null;
  /** Main paragraphs joined by blank lines ('' if nothing usable). */
  text: string;
};

const BOILERPLATE = [
  /skip to (main )?content/i, /accessibility help/i, /keyboard shortcuts/i, /navigation menu/i,
  /livestream/i, /sign up\b/i, /subscribe\b/i, /newsletter/i, /cookie/i, /all rights reserved/i,
  /advertisement/i, /image source/i, /hide caption/i, /getty images/i, /\bshare this\b/i,
  /book (an )?exhibit/i, /register now/i, /follow us/i, /read more:/i,
  /posts from this (topic|author) will be added/i, /per month/i, /cancel anytime/i,
  /digital access/i, /free trial/i, /already a subscriber/i, /this article is for subscribers/i,
];

function meta(html: string, prop: string): string | null {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']+)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${esc}["']`, 'i'));
  const v = a?.[1] ?? b?.[1];
  return v ? decodeEntities(v) : null;
}

/** Pure extraction step (tested separately from the network). */
export function extractArticle(html: string, pageUrl: string): ArticleText {
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const paras: string[] = [];
  for (const m of scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = oneLine(htmlToText(m[1]));
    if (t.length < 60) continue;
    if (BOILERPLATE.some((re) => re.test(t))) continue;
    // Navigation menus flattened into one "paragraph" have many camelCase joins.
    if ((t.match(/[a-z][A-Z]/g) ?? []).length > 6) continue;
    if (paras.includes(t)) continue;
    paras.push(t);
    if (paras.length >= 14) break;
  }
  const image = meta(html, 'og:image') ?? meta(html, 'twitter:image');
  return {
    ok: paras.length > 0,
    ogImage: cleanImageUrl(image, pageUrl),
    title: meta(html, 'og:title'),
    text: truncate(paras.join('\n\n'), 5000),
  };
}

/** Never throws. Google News links are redirects to JS pages, so they're skipped. */
export async function fetchArticle(url: string, timeoutMs = 8000): Promise<ArticleText> {
  if (/news\.google\.com/.test(url)) return { ok: false, ogImage: null, title: null, text: '' };
  const html = await fetchText(url, timeoutMs, 'text/html,application/xhtml+xml');
  if (!html) return { ok: false, ogImage: null, title: null, text: '' };
  return extractArticle(html, url);
}
