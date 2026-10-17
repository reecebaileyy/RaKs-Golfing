import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createWeatherService } from "..";
import { fakeProvider } from "../providers/fake";
import type { Conditions, WeatherProvider } from "../types";

type Row = Record<string, unknown> & { id: string; kind: "FORECAST" | "ACTUAL"; reservationId: string | null; matchId: string | null; createdAt: Date };

// Tiny in-memory stand-in for the parts of Prisma the service touches.
function fakeDb(startsAt: Date) {
  const rows: Row[] = [];
  let n = 0;
  const teeTime = { startsAt, course: { latitude: 33.9, longitude: -117.9 } };
  const matchesById: Record<string, { id: string; reservationId: string | null }> = { m1: { id: "m1", reservationId: "r1" } };
  const db = {
    match: {
      findUnique: async ({ where }: { where: { id: string } }) => (matchesById[where.id] ? { ...matchesById[where.id], teeTime } : null),
      findMany: async () => Object.values(matchesById).filter((m) => !rows.some((r) => r.kind === "ACTUAL" && r.matchId === m.id)),
    },
    reservation: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === "r1" ? { id: "r1", match: { id: "m1" }, teeTime } : null),
      findMany: async () => [{ id: "r1" }],
    },
    weatherSnapshot: {
      findMany: async ({ where }: { where: { OR: Array<{ reservationId?: string; matchId?: string }> } }) =>
        rows.filter((r) => where.OR.some((c) => (c.reservationId && r.reservationId === c.reservationId) || (c.matchId && r.matchId === c.matchId))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      create: async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
        const row = { ...data, id: `s${++n}`, createdAt: new Date(Date.now() + n) } as Row;
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data),
    },
  };
  return { db: db as unknown as PrismaClient, rows };
}

function stub(overrides: Partial<WeatherProvider> = {}) {
  const forecastAt = vi.fn(overrides.forecastAt ?? fakeProvider.forecastAt);
  const actualAt = vi.fn(overrides.actualAt ?? fakeProvider.actualAt);
  return { name: "fake", forecastAt, actualAt } as WeatherProvider & { forecastAt: typeof forecastAt; actualAt: typeof actualAt };
}

const T0 = new Date("2026-10-17T15:00:00Z");
const before = new Date("2026-10-16T12:00:00Z");
const during = new Date("2026-10-17T15:30:00Z");
const after = new Date("2026-10-17T18:00:00Z");

describe("snapshotForecast", () => {
  it("saves a FORECAST linked to the reservation and its match, once", async () => {
    const { db, rows } = fakeDb(T0);
    const provider = stub();
    const svc = createWeatherService({ db, provider: () => provider, now: () => before });
    await svc.snapshotForecast({ reservationId: "r1" });
    await svc.snapshotForecast({ reservationId: "r1", matchId: "m1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "FORECAST", provider: "fake", reservationId: "r1", matchId: "m1", forTime: T0 });
    expect(provider.forecastAt).toHaveBeenCalledTimes(1);
  });
  it("never throws, and saves nothing when the provider has no forecast", async () => {
    const { db, rows } = fakeDb(T0);
    const svc = createWeatherService({ db, provider: () => stub({ forecastAt: async () => null }), now: () => before });
    await expect(svc.snapshotForecast({ reservationId: "r1" })).resolves.toBeUndefined();
    const boom = createWeatherService({
      db,
      provider: () => stub({ forecastAt: async () => { throw new Error("x"); } }),
      now: () => before,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(boom.snapshotForecast({ reservationId: "r1" })).resolves.toBeUndefined();
    await expect(createWeatherService({ db, provider: () => stub(), now: () => before }).snapshotForecast({ reservationId: "nope" })).resolves.toBeUndefined();
    expect(rows).toHaveLength(0);
  });
});

describe("conditionsFor", () => {
  it("returns null with nothing saved before the round", async () => {
    const { db } = fakeDb(T0);
    const svc = createWeatherService({ db, provider: () => stub({ forecastAt: async () => null }), now: () => before });
    expect(await svc.conditionsFor({ reservationId: "r1" })).toBeNull();
  });

  it("prefers the forecast until an hour after the tee time, without calling the provider", async () => {
    const { db } = fakeDb(T0);
    const provider = stub();
    const svc = createWeatherService({ db, provider: () => provider, now: () => before });
    await svc.snapshotForecast({ reservationId: "r1" });
    const live = createWeatherService({ db, provider: () => provider, now: () => during });
    expect((await live.conditionsFor({ matchId: "m1" }))?.kind).toBe("FORECAST");
    expect(provider.actualAt).not.toHaveBeenCalled();
  });

  it("fetches and saves the ACTUAL lazily after the round, then prefers it", async () => {
    const { db, rows } = fakeDb(T0);
    const provider = stub();
    await createWeatherService({ db, provider: () => provider, now: () => before }).snapshotForecast({ reservationId: "r1" });
    const svc = createWeatherService({ db, provider: () => provider, now: () => after });
    const first = await svc.conditionsFor({ reservationId: "r1" });
    expect(first?.kind).toBe("ACTUAL");
    expect(rows.map((r) => r.kind).sort()).toEqual(["ACTUAL", "FORECAST"]);
    expect(rows.find((r) => r.kind === "ACTUAL")).toMatchObject({ reservationId: "r1", matchId: "m1", forTime: T0 });
    const again = await svc.conditionsFor({ matchId: "m1" });
    expect(again?.kind).toBe("ACTUAL");
    expect(provider.actualAt).toHaveBeenCalledTimes(1);
    expect((await svc.forecastFor({ matchId: "m1" }))?.kind).toBe("FORECAST");
  });

  it("falls back to the forecast and doesn't retry on every view when the provider returns null", async () => {
    const { db } = fakeDb(T0);
    const provider = stub({ actualAt: async () => null });
    await createWeatherService({ db, provider: () => provider, now: () => before }).snapshotForecast({ reservationId: "r1" });
    let clock = after;
    const svc = createWeatherService({ db, provider: () => provider, now: () => clock });
    expect((await svc.conditionsFor({ reservationId: "r1" }))?.kind).toBe("FORECAST");
    expect((await svc.conditionsFor({ reservationId: "r1" }))?.kind).toBe("FORECAST");
    expect(provider.actualAt).toHaveBeenCalledTimes(1);
    clock = new Date(after.getTime() + 31 * 60_000);
    await svc.conditionsFor({ reservationId: "r1" });
    expect(provider.actualAt).toHaveBeenCalledTimes(2);
  });
});

describe("refreshActuals", () => {
  it("saves one ACTUAL for finished tee times and skips ones that have it", async () => {
    const { db, rows } = fakeDb(T0);
    const provider = stub();
    const svc = createWeatherService({ db, provider: () => provider, now: () => after });
    expect(await svc.refreshActuals(after)).toBe(1);
    expect(rows.filter((r) => r.kind === "ACTUAL")).toHaveLength(1);
    expect(await svc.refreshActuals(after)).toBe(0);
  });
});

describe("Conditions shape", () => {
  it("is what the fake provider returns", async () => {
    const c: Conditions | null = await fakeProvider.forecastAt(33.9, -117.9, T0);
    expect(c?.forTime).toEqual(T0);
  });
});
