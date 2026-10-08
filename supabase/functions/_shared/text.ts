// Text utilities: HTML → plain text, word counts, slugs, tokens for dedupe.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', euro: '€', pound: '£',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Strip tags, decode entities, collapse whitespace. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|figure)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`;
}

export function wordCount(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function slugify(s: string, max = 60): string {
  const slug = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, max).replace(/-+$/, '') || 'story';
}

const STOPWORDS = new Set(
  (
    'a an the and or but of to in on at for from by with as is are was were be been being it its this that ' +
    'these those he she they we you i his her their our your after before over under into about than then ' +
    'new says said say will would could can may might has have had not no more most up down out off amid ' +
    'how why what when where who which while also just now first last one two three us its it\'s'
  ).split(/\s+/),
);

/** Lowercased content words, used for similarity. Keeps numbers ("$111b", "2002"). */
export function tokens(s: string): Set<string> {
  const words = s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9$€£%]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // Light stemming so "drones"/"drone" and "sinks"/"sink" match.
  return new Set(words.map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)));
}
