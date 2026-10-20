// Demo weather: a FORECAST for every seeded reservation and match, plus an ACTUAL once the tee time has passed.
// Uses the fake provider so seeding works offline.
import type { PrismaClient } from "@prisma/client";
import { fakeProvider } from "../../src/lib/weather/providers/fake";

const HOUR_MS = 3_600_000;

export async function seed(db: PrismaClient) {
  const teeTime = { select: { startsAt: true, course: { select: { latitude: true, longitude: true } } } } as const;
  const matches = await db.match.findMany({ select: { id: true, reservationId: true, teeTime } });
  const reservations = await db.reservation.findMany({ where: { status: "CONFIRMED" }, select: { id: true, match: { select: { id: true } }, teeTime } });

  // One entry per (reservation, match) pair; a match with a reservation is saved once with both ids.
  const targets = new Map<string, { reservationId: string | null; matchId: string | null; startsAt: Date; lat: number; lng: number }>();
  for (const m of matches) {
    targets.set(`${m.reservationId ?? ""}|${m.id}`, { reservationId: m.reservationId, matchId: m.id, startsAt: m.teeTime.startsAt, lat: m.teeTime.course.latitude, lng: m.teeTime.course.longitude });
  }
  for (const r of reservations) {
    const key = `${r.id}|${r.match?.id ?? ""}`;
    if (!targets.has(key)) targets.set(key, { reservationId: r.id, matchId: r.match?.id ?? null, startsAt: r.teeTime.startsAt, lat: r.teeTime.course.latitude, lng: r.teeTime.course.longitude });
  }

  let created = 0;
  for (const t of targets.values()) {
    const OR = [t.reservationId ? { reservationId: t.reservationId } : null, t.matchId ? { matchId: t.matchId } : null].filter((x) => x !== null);
    const have = new Set((await db.weatherSnapshot.findMany({ where: { OR }, select: { kind: true } })).map((s) => s.kind));
    const over = t.startsAt.getTime() + HOUR_MS < Date.now();
    for (const kind of ["FORECAST", "ACTUAL"] as const) {
      if (have.has(kind) || (kind === "ACTUAL" && !over)) continue;
      const c = await (kind === "FORECAST" ? fakeProvider.forecastAt : fakeProvider.actualAt)(t.lat, t.lng, t.startsAt);
      if (!c) continue;
      await db.weatherSnapshot.create({
        data: {
          kind, provider: c.provider, forTime: t.startsAt, reservationId: t.reservationId, matchId: t.matchId,
          tempF: c.tempF, feelsLikeF: c.feelsLikeF, windMph: c.windMph, windGustMph: c.windGustMph, windDir: c.windDir,
          precipChance: c.precipChance, precipIn: c.precipIn, humidity: c.humidity, conditions: c.conditions, icon: c.icon,
        },
      });
      created++;
    }
  }
  console.log(`weather: saved ${created} snapshots`);
}
