// Weather at the course for a tee time. Owned by the weather worker; signatures are the contract.
// A FORECAST is saved when the tee time is booked; the ACTUAL is fetched after the round and kept for good.
import type { PrismaClient, WeatherSnapshot } from "@prisma/client";
import { db as defaultDb } from "../db";
import { getProvider } from "./providers";
import type { Conditions, WeatherProvider } from "./types";

export type { Conditions, WeatherProvider } from "./types";

const HOUR_MS = 3_600_000;
const RETRY_AFTER_MS = 30 * 60_000;
// Google only serves the past day; Open-Meteo goes much further back. A week is plenty for a batch run.
const REFRESH_WINDOW_MS = 7 * 24 * HOUR_MS;

interface Target {
  reservationId: string | null;
  matchId: string | null;
  startsAt: Date;
  lat: number;
  lng: number;
}

export interface WeatherDeps {
  db: PrismaClient;
  provider: () => WeatherProvider;
  now: () => Date;
}

const TEE_TIME_SELECT = { select: { startsAt: true, course: { select: { latitude: true, longitude: true } } } } as const;

function toConditions(s: WeatherSnapshot): Conditions {
  return {
    kind: s.kind,
    provider: s.provider,
    forTime: s.forTime,
    tempF: s.tempF,
    feelsLikeF: s.feelsLikeF,
    windMph: s.windMph,
    windGustMph: s.windGustMph,
    windDir: s.windDir,
    precipChance: s.precipChance,
    precipIn: s.precipIn,
    humidity: s.humidity,
    conditions: s.conditions,
    icon: s.icon,
  };
}

/** "72°F · Wind 8 mph NW · Partly cloudy" (parts we have no number for are left out). */
export function conditionsLabel(c: Conditions): string {
  const parts: string[] = [];
  if (c.tempF != null) parts.push(`${Math.round(c.tempF)}°F`);
  if (c.windMph != null) {
    const speed = Math.round(c.windMph);
    parts.push(speed === 0 ? "Calm" : `Wind ${speed} mph${c.windDir ? ` ${c.windDir}` : ""}`);
  }
  if (c.conditions) parts.push(c.conditions);
  return parts.join(" · ");
}

export function createWeatherService(deps: WeatherDeps) {
  const { db } = deps;
  // Remembers failed after-round fetches so a page view never re-hits the provider on every load.
  const attempts = new Map<string, number>();

  async function loadTarget(input: { reservationId?: string | null; matchId?: string | null }): Promise<Target | null> {
    if (input.matchId) {
      const m = await db.match.findUnique({ where: { id: input.matchId }, select: { id: true, reservationId: true, teeTime: TEE_TIME_SELECT } });
      if (m) {
        return { reservationId: input.reservationId ?? m.reservationId, matchId: m.id, startsAt: m.teeTime.startsAt, lat: m.teeTime.course.latitude, lng: m.teeTime.course.longitude };
      }
    }
    if (input.reservationId) {
      const r = await db.reservation.findUnique({ where: { id: input.reservationId }, select: { id: true, match: { select: { id: true } }, teeTime: TEE_TIME_SELECT } });
      if (r) {
        return { reservationId: r.id, matchId: input.matchId ?? r.match?.id ?? null, startsAt: r.teeTime.startsAt, lat: r.teeTime.course.latitude, lng: r.teeTime.course.longitude };
      }
    }
    return null;
  }

  const idFilter = (ids: { reservationId?: string | null; matchId?: string | null }) =>
    [ids.reservationId ? { reservationId: ids.reservationId } : null, ids.matchId ? { matchId: ids.matchId } : null].filter((x): x is { reservationId: string } | { matchId: string } => x !== null);

  async function snapshotsFor(ids: { reservationId?: string | null; matchId?: string | null }) {
    const OR = idFilter(ids);
    if (OR.length === 0) return [];
    return db.weatherSnapshot.findMany({ where: { OR }, orderBy: { createdAt: "desc" } });
  }

  async function save(t: Target, c: Conditions) {
    await db.weatherSnapshot.create({
      data: {
        kind: c.kind,
        provider: c.provider,
        forTime: t.startsAt,
        reservationId: t.reservationId,
        matchId: t.matchId,
        tempF: c.tempF,
        feelsLikeF: c.feelsLikeF,
        windMph: c.windMph,
        windGustMph: c.windGustMph,
        windDir: c.windDir,
        precipChance: c.precipChance == null ? null : Math.round(c.precipChance),
        precipIn: c.precipIn,
        humidity: c.humidity == null ? null : Math.round(c.humidity),
        conditions: c.conditions,
        icon: c.icon,
      },
    });
  }

  /** Fetches and saves the ACTUAL for a tee time that is over. Returns what was saved, or null. */
  async function ensureActual(t: Target): Promise<Conditions | null> {
    const existing = (await snapshotsFor(t)).find((s) => s.kind === "ACTUAL");
    if (existing) return toConditions(existing);
    const key = `${t.reservationId ?? ""}|${t.matchId ?? ""}`;
    const last = attempts.get(key);
    const now = deps.now().getTime();
    if (last != null && now - last < RETRY_AFTER_MS) return null;
    attempts.set(key, now);
    const actual = await deps.provider().actualAt(t.lat, t.lng, t.startsAt);
    if (!actual) return null;
    await save(t, actual);
    return { ...actual, forTime: t.startsAt };
  }

  const isOver = (t: Target) => t.startsAt.getTime() + HOUR_MS < deps.now().getTime();

  return {
    async snapshotForecast(input: { reservationId: string; matchId?: string | null }): Promise<void> {
      try {
        const t = await loadTarget(input);
        if (!t || isOver(t)) return;
        const existing = (await snapshotsFor(t)).find((s) => s.kind === "FORECAST");
        if (existing) {
          // A match created after the booking joins the forecast saved at booking time.
          if (t.matchId && !existing.matchId) await db.weatherSnapshot.update({ where: { id: existing.id }, data: { matchId: t.matchId } });
          if (t.reservationId && !existing.reservationId) await db.weatherSnapshot.update({ where: { id: existing.id }, data: { reservationId: t.reservationId } });
          return;
        }
        const forecast = await deps.provider().forecastAt(t.lat, t.lng, t.startsAt);
        if (forecast) await save(t, forecast);
      } catch (err) {
        console.error("weather: could not save forecast", err);
      }
    },

    async conditionsFor(input: { reservationId?: string | null; matchId?: string | null }): Promise<Conditions | null> {
      try {
        const snaps = await snapshotsFor(input);
        const actual = snaps.find((s) => s.kind === "ACTUAL");
        if (actual) return toConditions(actual);
        const t = await loadTarget(input);
        if (t && isOver(t)) {
          const fetched = await ensureActual(t);
          if (fetched) return fetched;
        }
        const forecast = snaps.find((s) => s.kind === "FORECAST");
        return forecast ? toConditions(forecast) : null;
      } catch (err) {
        console.error("weather: could not read conditions", err);
        return null;
      }
    },

    /** The forecast saved at booking, even once an ACTUAL exists (for forecast-vs-actual displays). */
    async forecastFor(input: { reservationId?: string | null; matchId?: string | null }): Promise<Conditions | null> {
      try {
        const forecast = (await snapshotsFor(input)).find((s) => s.kind === "FORECAST");
        return forecast ? toConditions(forecast) : null;
      } catch {
        return null;
      }
    },

    /** Batch run for a cron: saves the ACTUAL for every recent finished tee time that lacks one. Returns how many were saved. */
    async refreshActuals(now: Date = deps.now()): Promise<number> {
      let saved = 0;
      try {
        const startsAt = { gte: new Date(now.getTime() - REFRESH_WINDOW_MS), lt: new Date(now.getTime() - HOUR_MS) };
        const noActual = { none: { kind: "ACTUAL" as const } };
        const matches = await db.match.findMany({ where: { teeTime: { startsAt }, weather: noActual }, select: { id: true, reservationId: true } });
        const reservations = await db.reservation.findMany({ where: { status: "CONFIRMED", teeTime: { startsAt }, weather: noActual }, select: { id: true } });
        const inputs = [...matches.map((m) => ({ matchId: m.id, reservationId: m.reservationId })), ...reservations.map((r) => ({ reservationId: r.id }))];
        for (const input of inputs) {
          const t = await loadTarget(input);
          if (!t) continue;
          const hadActual = (await snapshotsFor(t)).some((s) => s.kind === "ACTUAL");
          if (hadActual) continue;
          if (await ensureActual(t)) saved++;
        }
      } catch (err) {
        console.error("weather: refreshActuals failed", err);
      }
      return saved;
    },
  };
}

const service = createWeatherService({ db: defaultDb, provider: () => getProvider(), now: () => new Date() });

/** Saves the forecast for a booked tee time. Never throws: a weather outage must not block a booking. */
export const snapshotForecast = service.snapshotForecast;

/** Best conditions known for a match or reservation: ACTUAL once the round is over, otherwise the FORECAST. Fetches the actual lazily after the tee time. */
export const conditionsFor = service.conditionsFor;

export const forecastFor = service.forecastFor;
export const refreshActuals = service.refreshActuals;
