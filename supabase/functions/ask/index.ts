// ask: "Ask a question about this" (Layer 3).
//   POST {date, storyId, question} (+ header x-device-id) → {answer, answeredFromSources}
// Answers only from the story's source articles (world edition or a regional section).
// Capped per device and in total over 24 hours (caps.ts); never sent to Mistral or Gemini.

import { capsFor, overCap } from '../_shared/caps.ts';
import { generateJson } from '../_shared/llm.ts';
import { json, preflight, readJsonBody } from '../_shared/http.ts';
import { ASK_SCHEMA, ASK_SYSTEM, askPrompt, fitSources, type SourceText } from '../_shared/prompts.ts';
import { aiErrorResponse, checkStoryRef } from '../_shared/request.ts';
import { countRequests, finishRequest, knownDevice, loadStory, loadStoryContext, logAsk, logRequest } from '../_shared/store.ts';
import { validateAnswer } from '../_shared/validate.ts';

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

  let requestId: number | null = null;
  try {
    const deviceId = await knownDevice(req.headers.get('x-device-id'));
    const over = overCap('ask', deviceId !== null, await countRequests('ask', deviceId), capsFor('ask'));
    if (over) return json({ error: over }, 429);

    const story = await loadStory(ref.date, ref.storyId);
    if (!story) return json({ error: 'Story not found.' }, 404);
    const context = await loadStoryContext(ref.date, ref.storyId);
    const sources: SourceText[] = context.length
      ? context
      : [{ name: 'Brewsy', url: '', title: story.headline, text: `${story.whatHappened}\n\n${story.whyItMatters}\n\n${story.background}` }];

    // Logged before the AI call, so a failed call still counts toward the caps.
    requestId = await logRequest('ask', deviceId, ref.date, ref.storyId);
    const res = await generateJson({
      purpose: 'ask',
      system: ASK_SYSTEM,
      prompt: askPrompt(story.headline, question, fitSources(sources, 24_000, 5000)),
      // Groq's free tier takes about 7k tokens per request: the sources share what's left.
      fitPrompt: (maxChars) => askPrompt(story.headline, question, fitSources(sources, maxChars - askPrompt(story.headline, question, []).length, 5000)),
      schema: ASK_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1500,
      thinking: 'LOW',
      timeoutMs: 45_000,
    });
    const v = validateAnswer(res.data);
    await finishRequest(requestId, v.ok, res.provider ?? null);
    if (!v.ok) return json({ error: "Couldn't answer that right now. Try rephrasing." }, 502);
    await logAsk(ref.date, ref.storyId, question, v.value.answeredFromSources).catch(() => {});
    return json(v.value);
  } catch (e) {
    console.error(JSON.stringify({ event: 'ask_failed', message: String(e) }));
    await finishRequest(requestId, false, null);
    const { status, error } = aiErrorResponse(e);
    return json({ error }, status);
  }
});
