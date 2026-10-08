// Supabase Storage over REST, with the project's secret key (bypasses RLS).
// Audio lives in the PUBLIC `audio` bucket (see migrations), so the app can
// stream and download it by URL without a key.

import { authHeaders, baseUrl, serviceKey } from './db.ts';

export const AUDIO_BUCKET = 'audio';

export function publicUrl(path: string, bucket = AUDIO_BUCKET): string {
  return `${baseUrl()}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Uploads (or replaces) a file and returns its public URL. */
export async function uploadPublic(path: string, bytes: Uint8Array, contentType = 'audio/mpeg', bucket = AUDIO_BUCKET): Promise<string> {
  const res = await fetch(`${baseUrl()}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { ...authHeaders(serviceKey()), 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: bytes as Uint8Array<ArrayBuffer>,
  });
  if (!res.ok) throw new Error(`Storage upload ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  await res.body?.cancel();
  return publicUrl(path, bucket);
}

type ListEntry = { name: string; id: string | null };

/** One level of a folder: files have an id, sub-folders don't. */
export async function list(prefix: string, bucket = AUDIO_BUCKET): Promise<ListEntry[]> {
  const res = await fetch(`${baseUrl()}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...authHeaders(serviceKey()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) throw new Error(`Storage list ${prefix} failed (${res.status})`);
  return (await res.json()) as ListEntry[];
}

/** Every file path under a folder (recursive). */
async function listFiles(prefix: string, bucket: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await list(prefix, bucket)) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id) out.push(path);
    else out.push(...(await listFiles(path, bucket)));
  }
  return out;
}

export async function removeFiles(paths: string[], bucket = AUDIO_BUCKET): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const res = await fetch(`${baseUrl()}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { ...authHeaders(serviceKey()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
    });
    if (!res.ok) throw new Error(`Storage delete failed (${res.status})`);
    await res.body?.cancel();
  }
}

/** Date folders (YYYY-MM-DD) older than `keepDays` before `today`. Pure; tested. */
export function staleDateFolders(folders: string[], today: string, keepDays: number): string[] {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * 86_400_000).toISOString().slice(0, 10);
  return folders.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f < cutoff);
}

/** Deletes audio for days older than `keepDays`. Never throws. */
export async function cleanupOldAudio(today: string, keepDays: number): Promise<number> {
  try {
    const folders = (await list('')).filter((e) => !e.id).map((e) => e.name);
    let removed = 0;
    for (const folder of staleDateFolders(folders, today, keepDays)) {
      const files = await listFiles(folder, AUDIO_BUCKET);
      if (files.length) await removeFiles(files);
      removed += files.length;
    }
    return removed;
  } catch {
    return 0;
  }
}
