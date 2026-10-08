import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { createPersistedStore } from '@/lib/persisted';

/**
 * Keeps briefing MP3s on the phone so playback is instant and works offline.
 * Files are named by a hash of their URL (the server puts a version in every URL,
 * so a regenerated briefing never reuses an old file).
 */
const KEEP_DAYS = 4;

type Index = { files: Record<string, string> }; // url -> saved at (ISO)
const indexStore = createPersistedStore<Index>('brewsy:audio-downloads', { files: {} });
export const hydrateDownloads = indexStore.hydrate;

const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

function dir(): Directory | null {
  if (Platform.OS === 'web') return null;
  try {
    return new Directory(Paths.document, 'listen');
  } catch {
    return null;
  }
}

function nameFor(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, '0')}-${url.length}.mp3`;
}

function fileFor(url: string): File | null {
  const d = dir();
  return d ? new File(d, nameFor(url)) : null;
}

/** The downloaded copy's file:// URI, or null. */
export function localAudioUri(url: string): string | null {
  try {
    const f = fileFor(url);
    return f?.exists ? f.uri : null;
  } catch {
    return null;
  }
}

/** Downloads once (concurrent calls share one download). Never throws. */
export function downloadAudio(url: string): Promise<string | null> {
  const existing = localAudioUri(url);
  if (existing) return Promise.resolve(existing);
  const running = inflight.get(url);
  if (running) return running;
  const d = dir();
  if (!d) return Promise.resolve(null);

  const task = (async () => {
    try {
      d.create({ intermediates: true, idempotent: true });
      const target = new File(d, nameFor(url));
      const out = await File.downloadFileAsync(url, target, { idempotent: true });
      indexStore.set((s) => ({ files: { ...s.files, [url]: new Date().toISOString() } }));
      prune();
      return out.uri;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
      bump();
    }
  })();
  inflight.set(url, task);
  bump();
  return task;
}

/** Deletes downloads older than a few days. */
function prune() {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const keep: Record<string, string> = {};
  for (const [url, at] of Object.entries(indexStore.get().files)) {
    if (Date.parse(at) > cutoff) {
      keep[url] = at;
      continue;
    }
    try {
      const f = fileFor(url);
      if (f?.exists) f.delete();
    } catch {
      // Already gone or locked; try again next time.
    }
  }
  indexStore.set({ files: keep });
}

export type DownloadStatus = 'none' | 'downloading' | 'downloaded';

export function downloadStatus(url: string | null | undefined): DownloadStatus {
  if (!url || Platform.OS === 'web') return 'none';
  if (inflight.has(url)) return 'downloading';
  return localAudioUri(url) ? 'downloaded' : 'none';
}

export function useDownloadStatus(url: string | null | undefined): DownloadStatus {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version,
  );
  return downloadStatus(url);
}
