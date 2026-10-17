// Network helpers shared by providers: bounded wait, never throws.

export const WEATHER_TIMEOUT_MS = 5000;
export const HOUR_MS = 3_600_000;

/** GET a JSON document. Returns null on any network error, timeout, non-2xx status or bad JSON. */
export async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function roundToHour(date: Date): number {
  return Math.round(date.getTime() / HOUR_MS) * HOUR_MS;
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
