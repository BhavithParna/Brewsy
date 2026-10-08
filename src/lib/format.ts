import type { MarketQuote } from '@/data/types';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayParts(key: string) {
  const date = parseDateKey(key);
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: MONTHS[date.getMonth()],
    weekday: WEEKDAYS[date.getDay()],
    /** "8 October" */
    dayMonth: `${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`,
    /** For screen readers: "Wednesday, 7 October". */
    long: `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`,
  };
}

/** "Tue 7 Oct" */
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_TITLE[d.getMonth()]}`;
}

/** { hour: 5, minute: 30 } -> "5:30am" */
export function formatWakeTime(t: { hour: number; minute: number }): string {
  const suffix = t.hour < 12 ? 'am' : 'pm';
  const h = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${h}:${String(t.minute).padStart(2, '0')}${suffix}`;
}

function num(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMarketValue(q: MarketQuote): string {
  switch (q.format) {
    case 'percent':
      return `${num(q.value, 2)}%`;
    case 'usd':
      return `$${num(q.value, q.value >= 1000 ? 0 : 2)}`;
    default:
      return num(q.value, q.value >= 10000 ? 0 : 2);
  }
}

export function formatMarketChange(q: MarketQuote): string {
  const sign = q.change > 0 ? '+' : q.change < 0 ? '−' : '';
  const abs = Math.abs(q.change);
  return q.changeUnit === 'bp' ? `${sign}${abs} bp` : `${sign}${abs.toFixed(2)}%`;
}

export function marketA11yLabel(q: MarketQuote): string {
  const dir = q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'unchanged';
  const unit = q.changeUnit === 'bp' ? 'basis points' : 'percent';
  return `${q.label}, ${formatMarketValue(q)}, ${dir} ${Math.abs(q.change)} ${unit}`;
}

/** Splits text into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Hostname for display, e.g. "cnbc.com". */
export function hostOf(url: string): string {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
  return m ? m[1] : url;
}
