// Hand-written validators for every AI reply. The AI's JSON is never trusted
// as-is: required text must be present, ids must exist, arrays are trimmed.

import type { AskAnswer, CalendarEvent, DeepDive, KeyPlayer, KeyTerm, Topic } from './types.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

// deno-lint-ignore no-explicit-any
type Raw = any;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ─── Pass 1 ───

export type Pick = { clusterIds: string[]; topic: Topic };

export function validatePicks(raw: Raw, known: Set<string>, topics: Topic[], minPicks = 5): Result<Pick[]> {
  const errors: string[] = [];
  const list: Raw[] = Array.isArray(raw?.picks) ? raw.picks : [];
  if (!list.length && minPicks > 0) return { ok: false, errors: ['"picks" must be a non-empty array'] };
  const used = new Set<string>();
  const picks: Pick[] = [];
  for (const [i, p] of list.entries()) {
    const id = str(p?.clusterId);
    if (!known.has(id)) {
      errors.push(`picks[${i}].clusterId "${id}" is not a candidate id`);
      continue;
    }
    if (used.has(id)) continue;
    const topic = str(p?.topic) as Topic;
    if (!topics.includes(topic)) {
      errors.push(`picks[${i}].topic "${topic}" must be one of ${topics.join(', ')}`);
      continue;
    }
    const also = (Array.isArray(p?.alsoClusterIds) ? p.alsoClusterIds : [])
      .map(str)
      .filter((x: string) => known.has(x) && !used.has(x) && x !== id);
    [id, ...also].forEach((x) => used.add(x));
    picks.push({ clusterIds: [id, ...also], topic });
  }
  const need = Math.min(minPicks, known.size);
  if (picks.length < need) errors.push(`need at least ${need} valid picks, got ${picks.length}`);
  return errors.length && picks.length < need ? { ok: false, errors } : { ok: true, value: picks.slice(0, 16) };
}

// ─── Pass 1b: the editor's checklist ───

export type EditorAddition = { clusterId: string; topic: Topic; category: string; reason: string };
export type AlsoDraft = { clusterIds: string[]; topic: Topic; headline: string; whatHappened: string; whyItMatters: string; developing: boolean };
export type EditorResult = { additions: EditorAddition[]; alsoHappening: AlsoDraft[] };

/**
 * Additions must be real, not-yet-selected candidates; also-happening items must
 * point at candidates nobody else uses. Bad entries are dropped, never fatal.
 */
export function validateEditor(raw: Raw, ctx: { known: Set<string>; taken: Set<string>; topics: Topic[] }): EditorResult {
  const used = new Set(ctx.taken);
  const additions: EditorAddition[] = [];
  for (const a of Array.isArray(raw?.additions) ? raw.additions : []) {
    const id = str(a?.clusterId);
    const topic = str(a?.topic) as Topic;
    if (!ctx.known.has(id) || used.has(id) || !ctx.topics.includes(topic)) continue;
    used.add(id);
    additions.push({ clusterId: id, topic, category: str(a?.category) || 'other', reason: str(a?.reason) });
    if (additions.length >= 4) break;
  }
  const alsoHappening: AlsoDraft[] = [];
  for (const a of Array.isArray(raw?.alsoHappening) ? raw.alsoHappening : []) {
    if (!isObj(a)) continue;
    const ids = [...new Set((Array.isArray(a.clusterIds) ? a.clusterIds : []).map(str))].filter((id) => ctx.known.has(id) && !used.has(id));
    const topic = str(a.topic) as Topic;
    const headline = str(a.headline).replace(/\.$/, '');
    const whatHappened = str(a.whatHappened);
    if (!ids.length || !ctx.topics.includes(topic) || !headline || !whatHappened) continue;
    ids.forEach((id) => used.add(id));
    alsoHappening.push({ clusterIds: ids, topic, headline, whatHappened, whyItMatters: str(a.whyItMatters), developing: a.developing === true });
    if (alsoHappening.length >= 15) break;
  }
  return { additions, alsoHappening };
}

// ─── Pass 2 ───

export type StoryDraft = {
  clusterIds: string[];
  topic: Topic;
  headline: string;
  dek: string;
  whatHappened: string;
  whyItMatters: string;
  explainSimply: string;
  background: string;
  keyPlayers: KeyPlayer[];
  keyTerms: KeyTerm[];
  whatToWatch: string[];
  developing: boolean;
};

export type EditionDraft = { summary: string[]; calendar: CalendarEvent[]; stories: StoryDraft[] };

const REQUIRED_TEXT = ['headline', 'dek', 'whatHappened', 'whyItMatters', 'explainSimply', 'background'] as const;

/** One batch of written stories. Invalid stories are reported and skipped. */
export function validateStories(
  raw: Raw,
  ctx: { known: Set<string>; topics: Topic[]; minStories: number },
): Result<StoryDraft[]> {
  const errors: string[] = [];
  const stories: StoryDraft[] = [];
  const seenClusterSets = new Set<string>();
  const rawStories: Raw[] = Array.isArray(raw?.stories) ? raw.stories : [];
  for (const [i, s] of rawStories.entries()) {
    if (!isObj(s)) {
      errors.push(`stories[${i}] must be an object`);
      continue;
    }
    const where = `stories[${i}]`;
    const missing = REQUIRED_TEXT.filter((k) => !str(s[k]));
    if (missing.length) {
      errors.push(`${where} is missing ${missing.join(', ')}`);
      continue;
    }
    const topic = str(s.topic) as Topic;
    if (!ctx.topics.includes(topic)) {
      errors.push(`${where}.topic "${topic}" must be one of ${ctx.topics.join(', ')}`);
      continue;
    }
    const clusterIds = [...new Set((Array.isArray(s.clusterIds) ? s.clusterIds : []).map(str))].filter((id) => ctx.known.has(id));
    if (!clusterIds.length) {
      errors.push(`${where}.clusterIds must echo the STORY block ids`);
      continue;
    }
    const key = [...clusterIds].sort().join(',');
    if (seenClusterSets.has(key)) continue; // duplicate story
    seenClusterSets.add(key);

    stories.push({
      clusterIds,
      topic,
      headline: str(s.headline).replace(/\.$/, ''),
      dek: str(s.dek),
      whatHappened: str(s.whatHappened),
      whyItMatters: str(s.whyItMatters),
      explainSimply: str(s.explainSimply),
      background: str(s.background),
      keyPlayers: (Array.isArray(s.keyPlayers) ? s.keyPlayers : [])
        .filter(isObj)
        .map((p: Raw) => ({ name: str(p.name), role: str(p.role) }))
        .filter((p: KeyPlayer) => p.name && p.role)
        .slice(0, 5),
      keyTerms: (Array.isArray(s.keyTerms) ? s.keyTerms : [])
        .filter(isObj)
        .map((t: Raw) => ({ term: str(t.term), definition: str(t.definition) }))
        .filter((t: KeyTerm) => t.term && t.definition)
        .slice(0, 4),
      whatToWatch: (Array.isArray(s.whatToWatch) ? s.whatToWatch : []).map(str).filter(Boolean).slice(0, 3),
      developing: s.developing === true,
    });
  }
  if (stories.length < ctx.minStories) errors.push(`need at least ${ctx.minStories} valid stories, got ${stories.length}`);
  return stories.length < ctx.minStories ? { ok: false, errors } : { ok: true, value: stories };
}

/** The 60-second version + "On the radar". */
export function validateSummary(raw: Raw, topics: Topic[]): Result<{ summary: string[]; calendar: CalendarEvent[] }> {
  if (!isObj(raw)) return { ok: false, errors: ['reply must be a JSON object'] };
  const summary = (Array.isArray(raw.summary) ? raw.summary : []).map(str).filter(Boolean);
  if (summary.length < 4) return { ok: false, errors: [`"summary" needs 4 non-empty sentences, got ${summary.length}`] };
  const calendar: CalendarEvent[] = (Array.isArray(raw.calendar) ? raw.calendar : [])
    .filter(isObj)
    .map((e: Raw) => {
      const topic = str(e.topic) as Topic;
      return { time: str(e.time) || null, title: str(e.title), ...(topics.includes(topic) ? { topic } : {}) };
    })
    .filter((e: CalendarEvent) => e.title)
    .slice(0, 6);
  return { ok: true, value: { summary: summary.slice(0, 4), calendar } };
}

/** Summary + calendar + stories in one reply (the single-call shape, kept for tests and tools). */
export function validateEdition(
  raw: Raw,
  ctx: { known: Set<string>; topics: Topic[]; minStories: number },
): Result<EditionDraft> {
  if (!isObj(raw)) return { ok: false, errors: ['reply must be a JSON object'] };
  const sum = validateSummary(raw, ctx.topics);
  const st = validateStories(raw, ctx);
  const errors = [...(sum.ok ? [] : sum.errors), ...(st.ok ? [] : st.errors)];
  if (!sum.ok || !st.ok) return { ok: false, errors };
  return { ok: true, value: { ...sum.value, stories: st.value.slice(0, 12) } };
}

// ─── Listening scripts ───

export type ScriptDraft = { summary: string; stories: { storyId: string; text: string }[] };

/** Every story needs a script; the order follows the edition, not the reply. */
export function validateScript(raw: Raw, storyIds: string[]): Result<ScriptDraft> {
  if (!isObj(raw)) return { ok: false, errors: ['reply must be a JSON object'] };
  const summary = str(raw.summary);
  const byId = new Map<string, string>();
  for (const s of Array.isArray(raw.stories) ? raw.stories : []) {
    const id = str(s?.storyId);
    const text = str(s?.text);
    if (id && text && !byId.has(id)) byId.set(id, text);
  }
  const missing = storyIds.filter((id) => !byId.has(id));
  const errors = [...(summary ? [] : ['"summary" is empty']), ...(missing.length ? [`no script for: ${missing.join(', ')}`] : [])];
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { summary, stories: storyIds.map((id) => ({ storyId: id, text: byId.get(id)! })) } };
}

// ─── Layer 3 ───

export function validateDeepDive(raw: Raw): Result<Omit<DeepDive, 'generatedAt'>> {
  if (!isObj(raw)) return { ok: false, errors: ['reply must be a JSON object'] };
  const context = str(raw.context);
  const openQuestions = (Array.isArray(raw.openQuestions) ? raw.openQuestions : []).map(str).filter(Boolean).slice(0, 4);
  const errors: string[] = [];
  if (context.length < 200) errors.push('"context" must be at least a couple of paragraphs');
  if (!openQuestions.length) errors.push('"openQuestions" needs at least one question');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      context,
      perspectives: (Array.isArray(raw.perspectives) ? raw.perspectives : [])
        .filter(isObj)
        .map((p: Raw) => ({ label: str(p.label), text: str(p.text) }))
        .filter((p: { label: string; text: string }) => p.label && p.text)
        .slice(0, 4),
      numbers: (Array.isArray(raw.numbers) ? raw.numbers : [])
        .filter(isObj)
        .map((n: Raw) => ({ figure: str(n.figure), meaning: str(n.meaning) }))
        .filter((n: { figure: string; meaning: string }) => n.figure && n.meaning)
        .slice(0, 6),
      openQuestions,
    },
  };
}

export function validateAnswer(raw: Raw): Result<AskAnswer> {
  if (!isObj(raw) || !str(raw.answer) || typeof raw.answeredFromSources !== 'boolean') {
    return { ok: false, errors: ['reply must be {"answer": string, "answeredFromSources": boolean}'] };
  }
  return { ok: true, value: { answer: str(raw.answer), answeredFromSources: raw.answeredFromSources } };
}
