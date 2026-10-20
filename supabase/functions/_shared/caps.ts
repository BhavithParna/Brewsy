// Daily caps for Ask and Go deeper, over a rolling 24 hours, so friends sharing the free
// AI allowance can't use it all up. Each is a secret, with these defaults:
//
//   Ask         ASK_CAP_DEVICE=5      per device   ASK_CAP_TOTAL=60      for everyone
//   Go deeper   DEEPER_CAP_DEVICE=8   per device   DEEPER_CAP_TOTAL=30   for everyone
//   requests without a known device id (older apps) share one bucket: AI_CAP_NO_DEVICE=10
//
// Go deeper counts new explainers only: one already made is served from the cache for free.

export type CapKind = 'ask' | 'deeper';
export type Caps = { perDevice: number; total: number; noDevice: number };

export const DEFAULT_CAPS: Record<CapKind, Caps> = {
  ask: { perDevice: 5, total: 60, noDevice: 10 },
  deeper: { perDevice: 8, total: 30, noDevice: 10 },
};

/** What the app shows, as is, when a cap is reached (HTTP 429). */
export const CAP_MESSAGE: Record<CapKind, string> = {
  ask: "You've used today's questions. They reset tomorrow.",
  deeper: "You've used today's deep dives. They reset tomorrow.",
};

function secret(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n >= 0 && Deno.env.get(name)?.trim() ? Math.floor(n) : fallback;
}

export function capsFor(kind: CapKind): Caps {
  const d = DEFAULT_CAPS[kind];
  const prefix = kind === 'ask' ? 'ASK' : 'DEEPER';
  return {
    perDevice: secret(`${prefix}_CAP_DEVICE`, d.perDevice),
    total: secret(`${prefix}_CAP_TOTAL`, d.total),
    noDevice: secret('AI_CAP_NO_DEVICE', d.noDevice),
  };
}

/**
 * The message to answer with if this request would go over a cap, else null. `mine` is
 * the device's count (or the shared no-device bucket's), `total` everyone's. Pure; tested.
 */
export function overCap(kind: CapKind, knownDevice: boolean, counts: { mine: number; total: number }, caps = capsFor(kind)): string | null {
  const own = knownDevice ? caps.perDevice : caps.noDevice;
  return counts.mine >= own || counts.total >= caps.total ? CAP_MESSAGE[kind] : null;
}
