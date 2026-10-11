import { Platform, Share } from 'react-native';

import type { Story } from '@/data/types';

/** First sentence of a paragraph, kept short enough for a message preview. */
function firstSentence(text: string, max = 220): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  const s = m ? m[0] : t;
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** What goes into the share sheet: headline, one line of summary and the main source. */
export function storyShareContent(story: Story) {
  const summary = story.dek.trim() || firstSentence(story.whatHappened);
  const source = story.sources[0] ?? story.allSources[0];
  const lines = [story.headline, summary].filter(Boolean);
  const link = source ? `${source.name}: ${source.url}` : null;
  return { title: story.headline, summary, url: source?.url ?? null, body: lines.join('\n\n'), link };
}

export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'failed';

/**
 * Opens the phone's share sheet for a story. On the web without a share sheet, the text is
 * copied instead (the caller says so).
 */
export async function shareStory(story: Story): Promise<ShareResult> {
  const c = storyShareContent(story);
  const signoff = 'via Brewsy';
  try {
    if (Platform.OS === 'ios' && c.url) {
      // iOS attaches the link separately (it previews it), so it stays out of the message.
      const res = await Share.share(
        { title: c.title, message: `${c.body}\n\n${signoff}`, url: c.url },
        { subject: c.title },
      );
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    }
    const message = [c.body, c.link, signoff].filter(Boolean).join('\n\n');
    // Desktop browsers often have no share sheet.
    const web = Platform.OS === 'web' ? (globalThis.navigator as Partial<Navigator> | undefined) : undefined;
    if (web && typeof web.share !== 'function') {
      await web.clipboard?.writeText(message);
      return web.clipboard ? 'copied' : 'failed';
    }
    const res = await Share.share({ title: c.title, message }, { dialogTitle: 'Share this story', subject: c.title });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (e) {
    // The web share sheet throws AbortError when it's closed without sharing.
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    return 'failed';
  }
}
