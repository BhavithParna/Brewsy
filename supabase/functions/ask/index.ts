// ask: "Ask a question about this" (Layer 3).
//   POST {date, storyId, question} → {answer, answeredFromSources}
// Answers only from the story's source articles. Capped at ASK_DAILY_LIMIT per day.

import { count } from '../_shared/db.ts';
import { generateJson } from '../_shared/llm.ts';
import { json, preflight, readJsonBody } from '../_shared/http.ts';
import { ASK_SCHEMA, ASK_SYSTEM, askPrompt, type SourceText } from '../_shared/prompts.ts';
import { aiErrorResponse, checkStoryRef } from '../_shared/request.ts';
import { loadStory, loadStoryContext, logAsk } from '../_shared/store.ts';
import { truncate } from '../_shared/text.ts';
import { validateAnswer } from '../_shared/validate.ts';

const ASK_DAILY_LIMIT = 100;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const body = await readJsonBody<{ date: string; storyId: string; question: string }>(req);
  const ref = checkStoryRef(body);
  if (typeof ref === 'string') return json({ error: ref }, 400);
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return json({ error: 'Type a question first.' }, 400);
  if (question.length > 300) return json({ error: 'Keep questions under 300 characters.' }, 400);

  try {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    if ((await count('ask_log', `created_at=gte.${encodeURIComponent(since)}`)) >= ASK_DAILY_LIMIT) {
      return json({ error: `That's the daily limit of ${ASK_DAILY_LIMIT} questions. Try again tomorrow.` }, 429);
    }

    const story = await loadStory(ref.date, ref.storyId);
    if (!story) return json({ error: 'Story not found.' }, 404);
    const context = await loadStoryContext(ref.date, ref.storyId);
    const sources: SourceText[] = context.length
      ? context.map((s) => ({ ...s, text: truncate(s.text, 5000) }))
      : [{ name: 'Brewsy', url: '', title: story.headline, text: `${story.whatHappened}\n\n${story.whyItMatters}\n\n${story.background}` }];

    const res = await generateJson({
      system: ASK_SYSTEM,
      prompt: askPrompt(story.headline, question, sources),
      schema: ASK_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
      thinking: 'LOW',
      timeoutMs: 45_000,
    });
    const v = validateAnswer(res.data);
    if (!v.ok) return json({ error: "Couldn't answer that right now. Try rephrasing." }, 502);
    await logAsk(ref.date, ref.storyId, question, v.value.answeredFromSources).catch(() => {});
    return json(v.value);
  } catch (e) {
    console.error(JSON.stringify({ event: 'ask_failed', message: String(e) }));
    const { status, error } = aiErrorResponse(e);
    return json({ error }, status);
  }
});
