// Minimal PostgREST client for the functions, using the project's secret key
// (bypasses RLS). No supabase-js needed.
//
// Key handling follows Supabase's API-key docs:
// - new secret keys (sb_secret_...) are NOT JWTs and go on the `apikey` header only;
// - legacy service_role keys are JWTs and also go on `Authorization: Bearer`.

export function serviceKey(): string {
  const dict = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (dict) {
    try {
      const keys = JSON.parse(dict) as Record<string, string>;
      const key = keys.default ?? Object.values(keys)[0];
      if (key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('No Supabase secret key in the environment (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY).');
}

export function baseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL is not set.');
  return url.replace(/\/$/, '');
}

export function authHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(serviceKey()),
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DB ${method} ${path.split('?')[0]} failed (${res.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** GET /rest/v1/<table>?<query> */
export function select<T>(table: string, query: string): Promise<T[]> {
  return request<T[]>('GET', `${table}?${query}`);
}

/** Insert or merge rows on the primary key (or `onConflict` columns). */
export async function upsert(table: string, rows: unknown, onConflict?: string): Promise<void> {
  const q = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  await request('POST', `${table}${q}`, rows, 'resolution=merge-duplicates,return=minimal');
}

/** Insert; rows that conflict are skipped. Returns the rows actually inserted. */
export function insertIgnore<T>(table: string, rows: unknown): Promise<T[]> {
  return request<T[]>('POST', table, rows, 'resolution=ignore-duplicates,return=representation');
}

/** PATCH rows matching `filter`; returns the updated rows (empty = nothing matched). */
export function update<T>(table: string, filter: string, values: unknown): Promise<T[]> {
  return request<T[]>('PATCH', `${table}?${filter}`, values, 'return=representation');
}

export function insert(table: string, rows: unknown): Promise<null> {
  return request<null>('POST', table, rows, 'return=minimal');
}

/** Exact row count for a filter (uses a HEAD request + Content-Range). */
export async function count(table: string, filter: string): Promise<number> {
  const res = await fetch(`${baseUrl()}/rest/v1/${table}?select=*&${filter}`, {
    method: 'HEAD',
    headers: { ...authHeaders(serviceKey()), Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range') ?? '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

/** Encode a value for a PostgREST filter, e.g. eq(date). */
export function eq(value: string): string {
  return `eq.${encodeURIComponent(value)}`;
}
