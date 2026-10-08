// Market snapshot: S&P 500, Nasdaq, Bitcoin, Oil (WTI), 10-year Treasury yield.
//
// Source: CNBC's public quote JSON (no key needed; tested working Oct 2026).
// Bitcoin falls back to CoinGecko if CNBC doesn't return it.
// A quote that can't be fetched is left out — never invented.

import type { MarketQuote } from './types.ts';
import { fetchWithTimeout } from './http.ts';

const CNBC_SYMBOLS: { symbol: string; quote: Omit<MarketQuote, 'value' | 'change'> }[] = [
  { symbol: '.SPX', quote: { id: 'spx', label: 'S&P 500', changeUnit: 'percent', format: 'index' } },
  { symbol: '.IXIC', quote: { id: 'ndx', label: 'Nasdaq', changeUnit: 'percent', format: 'index' } },
  { symbol: 'BTC.CB=', quote: { id: 'btc', label: 'Bitcoin', changeUnit: 'percent', format: 'usd' } },
  { symbol: '@CL.1', quote: { id: 'wti', label: 'Oil (WTI)', changeUnit: 'percent', format: 'usd' } },
  { symbol: 'US10Y', quote: { id: 'us10y', label: '10Y yield', changeUnit: 'bp', format: 'percent' } },
];

function num(s: unknown): number {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string') return NaN;
  return parseFloat(s.replace(/[,%+\s]/g, '').replace('−', '-'));
}

// deno-lint-ignore no-explicit-any
export function parseCnbcQuotes(payload: any): MarketQuote[] {
  const rows: Record<string, unknown>[] = payload?.FormattedQuoteResult?.FormattedQuote ?? [];
  const bySymbol = new Map(rows.map((r) => [String(r.symbol), r]));
  const out: MarketQuote[] = [];
  for (const { symbol, quote } of CNBC_SYMBOLS) {
    const r = bySymbol.get(symbol);
    if (!r) continue;
    const value = num(r.last);
    // Yields: CNBC's `change` is in percentage points (0.036 = 3.6 bp).
    const change = quote.changeUnit === 'bp' ? Math.round(num(r.change) * 100) : Math.round(num(r.change_pct) * 100) / 100;
    if (!Number.isFinite(value) || !Number.isFinite(change)) continue;
    out.push({ ...quote, value, change });
  }
  return out;
}

async function fetchCnbc(): Promise<MarketQuote[]> {
  const symbols = CNBC_SYMBOLS.map((s) => s.symbol).join('|');
  const url =
    'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol' +
    `?symbols=${encodeURIComponent(symbols)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`;
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 10_000);
    if (!res.ok) return [];
    return parseCnbcQuotes(await res.json());
  } catch {
    return [];
  }
}

async function fetchBitcoinFallback(): Promise<MarketQuote | null> {
  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
      { headers: { Accept: 'application/json' } },
      10_000,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const value = Number(data?.bitcoin?.usd);
    const change = Math.round(Number(data?.bitcoin?.usd_24h_change) * 100) / 100;
    if (!Number.isFinite(value) || !Number.isFinite(change)) return null;
    return { id: 'btc', label: 'Bitcoin', value, change, changeUnit: 'percent', format: 'usd' };
  } catch {
    return null;
  }
}

/** Never throws; returns whichever quotes could be fetched, in display order. */
export async function fetchMarkets(): Promise<MarketQuote[]> {
  const quotes = await fetchCnbc();
  if (!quotes.some((q) => q.id === 'btc')) {
    const btc = await fetchBitcoinFallback();
    if (btc) quotes.push(btc);
  }
  const order = CNBC_SYMBOLS.map((s) => s.quote.id);
  return quotes.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
