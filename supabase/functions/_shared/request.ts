// Input checks shared by go-deeper and ask.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const STORY_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function checkStoryRef(body: { date?: unknown; storyId?: unknown }): { date: string; storyId: string } | string {
  const date = typeof body.date === 'string' ? body.date : '';
  const storyId = typeof body.storyId === 'string' ? body.storyId : '';
  if (!DATE_RE.test(date)) return '"date" must be YYYY-MM-DD.';
  if (!STORY_ID_RE.test(storyId)) return '"storyId" is missing or invalid.';
  return { date, storyId };
}

/** Friendly message + status for AI errors (Claude or Gemini). */
export function aiErrorResponse(e: unknown): { status: number; error: string } {
  const message = e instanceof Error ? e.message : String(e);
  if (/daily limit/i.test(message)) {
    return { status: 429, error: 'Today’s free AI allowance is used up. Go deeper and questions work again tomorrow morning.' };
  }
  if (/HTTP 429|rate limit/i.test(message)) return { status: 503, error: 'The AI is busy right now. Try again in a minute.' };
  if (/HTTP 529|overloaded/i.test(message)) return { status: 503, error: 'The AI is overloaded right now. Try again in a minute.' };
  if (/GEMINI_API_KEY|ANTHROPIC_API_KEY|HTTP 401/.test(message)) return { status: 500, error: 'The AI key is not set up on the server.' };
  if (/declined/i.test(message)) return { status: 422, error: "The AI couldn't answer this one. Try a different question." };
  return { status: 502, error: "Couldn't generate an answer right now. Try again shortly." };
}
