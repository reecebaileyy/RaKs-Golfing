// A small in-memory limiter for unauthenticated endpoints (joining, asking for codes).
// It's per server instance, so on serverless hosting it slows abuse rather than stopping it;
// the database limits on codes and comments are the hard ones.

const hits = new Map<string, number[]>();

/** Records a hit for `key`; false when it already had `max` hits inside `windowMs`. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    // Drop the oldest keys so the map can't grow without bound.
    for (const k of [...hits.keys()].slice(0, 5_000)) hits.delete(k);
  }
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
