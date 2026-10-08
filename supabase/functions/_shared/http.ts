// Small HTTP helpers shared by every function.

/** Browser-like UA: several outlets (e.g. CNBC) refuse requests without one. */
export const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-brewsy-secret, x-device-id',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: CORS_HEADERS }) : null;
}

/** fetch() that gives up after `ms` milliseconds. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a URL as text, or null on any failure (timeouts, 4xx/5xx, network). */
export async function fetchText(
  url: string,
  ms = 15_000,
  accept = '*/*',
  /** Extra headers, e.g. the declared User-Agent the SEC requires. */
  headers: Record<string, string> = {},
): Promise<string | null> {
  const r = await fetchTextResult(url, ms, accept, headers);
  return 'text' in r ? r.text : null;
}

/** Like fetchText, but says why it failed ("HTTP 503", "timeout after 15s", the network error). */
export async function fetchTextResult(
  url: string,
  ms = 15_000,
  accept = '*/*',
  headers: Record<string, string> = {},
): Promise<{ text: string } | { error: string }> {
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: accept, ...headers } }, ms);
    if (!res.ok) {
      await res.body?.cancel();
      return { error: `HTTP ${res.status}` };
    }
    return { text: await res.text() };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { error: `timeout after ${Math.round(ms / 1000)}s` };
    const cause = e instanceof Error && e.cause instanceof Error ? `: ${e.cause.message}` : '';
    return { error: `${e instanceof Error ? e.message : String(e)}${cause}`.slice(0, 160) };
  }
}

export async function readJsonBody<T>(req: Request): Promise<Partial<T>> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Partial<T>) : {};
  } catch {
    return {};
  }
}
