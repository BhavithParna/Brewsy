// go-deeper: the on-demand "Go deeper with AI" explainer (Layer 3).
//   POST {date, storyId} (+ header x-device-id) → {deepDive, cached}
// Works for world stories and regional ones ("ca-…"). Results are cached in `deep_dives`,
// so the second request is instant and free; new ones are capped (caps.ts).

import { capsFor, overCap } from '../_shared/caps.ts';
import { generateJson } from '../_shared/llm.ts';
import { json, preflight, readJsonBody } from '../_shared/http.ts';
import { DEEP_DIVE_SCHEMA, DEEP_DIVE_SYSTEM, deepDivePrompt, fitSources, type SourceText } from '../_shared/prompts.ts';
import { aiErrorResponse, checkStoryRef } from '../_shared/request.ts';
import { countRequests, finishRequest, getDeepDive, knownDevice, loadStory, loadStoryContext, logRequest, saveDeepDive } from '../_shared/store.ts';
import type { DeepDive } from '../_shared/types.ts';
import { validateDeepDive } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const ref = checkStoryRef(await readJsonBody<{ date: string; storyId: string }>(req));
  if (typeof ref === 'string') return json({ error: ref }, 400);
  const key = `${ref.date}:${ref.storyId}`;

  let requestId: number | null = null;
  try {
    const cached = await getDeepDive(key);
    if (cached) return json({ deepDive: cached, cached: true });

    const deviceId = await knownDevice(req.headers.get('x-device-id'));
    const over = overCap('deeper', deviceId !== null, await countRequests('deeper', deviceId), capsFor('deeper'));
    if (over) return json({ error: over }, 429);

    const story = await loadStory(ref.date, ref.storyId);
    if (!story) return json({ error: 'Story not found.' }, 404);

    const context = await loadStoryContext(ref.date, ref.storyId);
    // Fall back to the story's own text if no article text was saved.
    const sources: SourceText[] = context.length
      ? context
      : [{ name: 'Brewsy', url: '', title: story.headline, text: `${story.whatHappened}\n\n${story.whyItMatters}\n\n${story.background}` }];

    // Logged before the AI call, so a failed call still counts toward the caps.
    requestId = await logRequest('deeper', deviceId, ref.date, ref.storyId);
    let feedback = '';
    let provider: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await generateJson({
        purpose: 'deeper',
        system: DEEP_DIVE_SYSTEM,
        prompt: deepDivePrompt(story, fitSources(sources, 40_000)) + feedback,
        fitPrompt: (maxChars) => deepDivePrompt(story, fitSources(sources, maxChars - deepDivePrompt(story, []).length - feedback.length)) + feedback,
        schema: DEEP_DIVE_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinking: 'LOW',
        timeoutMs: 60_000,
      });
      provider = res.provider ?? null;
      const v = validateDeepDive(res.data);
      if (v.ok) {
        const deepDive: DeepDive = { ...v.value, generatedAt: new Date().toISOString() };
        await saveDeepDive(key, ref.date, ref.storyId, deepDive);
        await finishRequest(requestId, true, provider);
        return json({ deepDive, cached: false });
      }
      feedback = `\n\nYour previous reply was rejected: ${v.errors.join('; ')}.`;
    }
    await finishRequest(requestId, false, provider);
    return json({ error: "Couldn't generate a valid explainer. Try again shortly." }, 502);
  } catch (e) {
    console.error(JSON.stringify({ event: 'go_deeper_failed', key, message: String(e) }));
    await finishRequest(requestId, false, null);
    const { status, error } = aiErrorResponse(e);
    return json({ error }, status);
  }
});
