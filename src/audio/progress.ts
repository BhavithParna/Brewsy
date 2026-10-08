import { createPersistedStore } from '@/lib/persisted';

/** Where you stopped, per session (chapter + seconds into it). */
type Saved = { index: number; position: number; savedAt: string };
type ProgressState = { sessions: Record<string, Saved> };

export const progressStore = createPersistedStore<ProgressState>('brewsy:listen-progress', { sessions: {} });

const KEEP_DAYS = 7;

export function savedProgress(sessionId: string): Saved | undefined {
  return progressStore.get().sessions[sessionId];
}

export function saveProgress(sessionId: string, index: number, position: number) {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  progressStore.set((s) => {
    const sessions: Record<string, Saved> = {};
    for (const [id, v] of Object.entries(s.sessions)) if (Date.parse(v.savedAt) > cutoff) sessions[id] = v;
    sessions[sessionId] = { index, position: Math.max(0, Math.floor(position)), savedAt: new Date().toISOString() };
    return { sessions };
  });
}

export function clearProgress(sessionId: string) {
  if (!progressStore.get().sessions[sessionId]) return;
  progressStore.set((s) => {
    const { [sessionId]: _, ...rest } = s.sessions;
    return { sessions: rest };
  });
}
