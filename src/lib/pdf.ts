import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { TOPICS, type Briefing, type Topic } from '@/data/types';
import { formatDayParts, formatMarketChange, formatMarketValue } from '@/lib/format';
import { TOPIC_LABEL } from '@/theme/themes';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Magazine-style HTML for the edition: a cover, then each story. */
export function editionHtml(b: Briefing, topics: Topic[] = TOPICS): string {
  const day = formatDayParts(b.date);
  const sections = TOPICS.filter((t) => topics.includes(t))
    .map((t) => ({ topic: t, stories: b.stories.filter((s) => s.topic === t) }))
    .filter((s) => s.stories.length > 0);

  const storiesHtml = sections
    .map(
      ({ topic, stories }) => `
      <section class="topic">
        <h2>${esc(TOPIC_LABEL[topic])}</h2>
        ${stories
          .map(
            (s) => `
          <article>
            <div class="meta">${esc(TOPIC_LABEL[s.topic])} · ${s.readTimeMinutes} min read</div>
            <h3>${esc(s.headline)}</h3>
            <p class="dek">${esc(s.dek)}</p>
            <h4>What happened</h4>
            <p>${esc(s.whatHappened)}</p>
            <h4>Why it matters</h4>
            <p class="why">${esc(s.whyItMatters)}</p>
            <div class="sources">Sources: ${s.allSources
              .map((src) => `<a href="${esc(src.url)}">${esc(src.name)}${src.title ? ` — ${esc(src.title)}` : ''}</a>`)
              .join('<br/>')}</div>
          </article>`,
          )
          .join('')}
      </section>`,
    )
    .join('');

  const markets = b.markets.length
    ? `<section class="markets"><h2>Markets</h2><table>${b.markets
        .map(
          (q) =>
            `<tr><td>${esc(q.label)}</td><td class="num">${esc(formatMarketValue(q))}</td><td class="num ${q.change >= 0 ? 'up' : 'down'}">${esc(formatMarketChange(q))}</td></tr>`,
        )
        .join('')}</table></section>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    @page { margin: 22mm 18mm; }
    body { font-family: Inter, -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #141416; font-size: 11.5pt; line-height: 1.55; }
    .cover { height: 92vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
    .brand { font-weight: 500; letter-spacing: .3em; text-transform: uppercase; font-size: 10pt; color: #8A8A90; }
    .date { letter-spacing: .4em; text-transform: uppercase; color: #8A8A90; font-size: 10pt; margin-top: 28pt; }
    .weekday { font-weight: 300; font-size: 64pt; line-height: 1.1; letter-spacing: -.03em; }
    .summary { margin-top: 36pt; border-top: 1px solid #E4E2DC; padding-top: 18pt; }
    .summary h2 { font-size: 12pt; margin: 0 0 10pt; }
    .summary ol { padding-left: 18pt; margin: 0; }
    .summary li { margin-bottom: 8pt; }
    h2 { font-size: 11pt; letter-spacing: .2em; text-transform: uppercase; margin: 26pt 0 6pt; }
    article { page-break-inside: avoid; padding: 14pt 0 16pt; border-bottom: 1px solid #ECEAE5; }
    .meta { font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; font-weight: 500; color: #8A8A90; }
    h3 { font-weight: 500; font-size: 17pt; line-height: 1.25; letter-spacing: -.01em; margin: 6pt 0 6pt; }
    .dek { color: #55555B; margin: 0 0 8pt; }
    h4 { font-size: 8.5pt; letter-spacing: .16em; text-transform: uppercase; color: #8A8A90; margin: 10pt 0 2pt; }
    p { margin: 0 0 6pt; }
    .why { border-left: 2pt solid #C9C6BF; padding-left: 9pt; }
    .sources { margin-top: 8pt; font-size: 8.5pt; color: #6B6B72; }
    .sources a { color: #6B6B72; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6pt 0; border-bottom: 1px solid #ECEAE5; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .up { color: #1E9E68; } .down { color: #D2492B; }
    .end { text-align: center; margin-top: 30pt; color: #8A8A90; font-size: 9pt; letter-spacing: .2em; text-transform: uppercase; }
  </style></head><body>
    <div class="cover">
      <div class="brand">Brewsy · Morning edition</div>
      <div class="date">${esc(day.dayMonth)}</div>
      <div class="weekday">${esc(day.weekday)}</div>
      <div class="summary"><h2>The 60-second version</h2><ol>${b.summary
        .map((s) => `<li>${esc(s)}</li>`)
        .join('')}</ol></div>
    </div>
    ${storiesHtml}
    ${markets}
    <div class="end">End of edition</div>
  </body></html>`;
}

/** Builds the PDF and opens the share sheet (save to Files, send, print…). */
export async function exportEditionPdf(b: Briefing, topics?: Topic[]): Promise<void> {
  const html = editionHtml(b, topics);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Brewsy · ${b.date}`,
    });
  }
}
