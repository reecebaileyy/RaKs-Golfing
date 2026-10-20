import { afterEach, describe, expect, it, vi } from "vitest";
import { describeWmo, degreesToCardinal } from "../wmo";
import { mapOpenMeteo, openMeteoProvider } from "../providers/openMeteo";
import { createGoogleProvider, mapGoogleHours, mapGoogleHour } from "../providers/google";
import { fakeProvider } from "../providers/fake";
import { getProvider, selectProviderName } from "../providers";
import { conditionsLabel } from "..";

afterEach(() => vi.unstubAllGlobals());

const TEE = new Date("2026-10-17T15:08:00Z");

const openMeteoBody = {
  hourly: {
    time: ["2026-10-17T14:00", "2026-10-17T15:00", "2026-10-17T16:00"],
    temperature_2m: [70, 72.4, 75],
    apparent_temperature: [69, 71, 74],
    precipitation_probability: [5, 10, 20],
    precipitation: [0, 0.02, 0.1],
    relative_humidity_2m: [50, 48, 44],
    weather_code: [0, 2, 61],
    wind_speed_10m: [5, 8.2, 12],
    wind_direction_10m: [300, 315, 330],
    wind_gusts_10m: [9, 14, 20],
  },
};

const googleHour = (start: string, extra: object = {}) => ({
  interval: { startTime: start, endTime: new Date(Date.parse(start) + 3_600_000).toISOString() },
  weatherCondition: { description: { text: "Partly cloudy", languageCode: "en" }, type: "PARTLY_CLOUDY" },
  temperature: { degrees: 72.5, unit: "FAHRENHEIT" },
  feelsLikeTemperature: { degrees: 71, unit: "FAHRENHEIT" },
  relativeHumidity: 48,
  precipitation: { probability: { percent: 15, type: "RAIN" }, qpf: { quantity: 0.01, unit: "INCHES" } },
  wind: { direction: { degrees: 315, cardinal: "NORTH_WEST" }, speed: { value: 8, unit: "MILES_PER_HOUR" }, gust: { value: 14, unit: "MILES_PER_HOUR" } },
  ...extra,
});

describe("WMO mapping", () => {
  it("maps codes to text and icon", () => {
    expect(describeWmo(0)).toEqual({ text: "Clear sky", icon: "sun" });
    expect(describeWmo(2)).toEqual({ text: "Partly cloudy", icon: "cloud" });
    expect(describeWmo(63).icon).toBe("rain");
    expect(describeWmo(73).icon).toBe("snow");
    expect(describeWmo(45).icon).toBe("fog");
    expect(describeWmo(95).icon).toBe("storm");
    expect(describeWmo(1234)).toEqual({ text: "Unknown", icon: null });
    expect(describeWmo(null).icon).toBeNull();
  });
  it("maps degrees to a compass point", () => {
    expect(degreesToCardinal(0)).toBe("N");
    expect(degreesToCardinal(315)).toBe("NW");
    expect(degreesToCardinal(359)).toBe("N");
    expect(degreesToCardinal(-45)).toBe("NW");
    expect(degreesToCardinal(null)).toBeNull();
  });
});

describe("Open-Meteo mapping", () => {
  it("picks the hour nearest the tee time", () => {
    const c = mapOpenMeteo(openMeteoBody, TEE, "FORECAST")!;
    expect(c).toMatchObject({ kind: "FORECAST", provider: "open-meteo", tempF: 72.4, feelsLikeF: 71, windMph: 8.2, windGustMph: 14, windDir: "NW", precipChance: 10, precipIn: 0.02, humidity: 48, conditions: "Partly cloudy", icon: "cloud" });
    expect(c.forTime).toEqual(TEE);
  });
  it("returns null when the hour is missing or the body is junk", () => {
    expect(mapOpenMeteo(openMeteoBody, new Date("2026-10-20T15:00:00Z"), "FORECAST")).toBeNull();
    expect(mapOpenMeteo({ error: true }, TEE, "FORECAST")).toBeNull();
    expect(mapOpenMeteo(null, TEE, "ACTUAL")).toBeNull();
  });
  it("fetches with imperial units and UTC", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(openMeteoBody)));
    vi.stubGlobal("fetch", fetchMock);
    const soon = new Date(Date.now() + 2 * 3_600_000);
    await openMeteoProvider.forecastAt(33.9, -117.9, soon);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("api.open-meteo.com/v1/forecast");
    expect(url).toContain("temperature_unit=fahrenheit");
    expect(url).toContain("wind_speed_unit=mph");
    expect(url).toContain("timezone=UTC");
  });
  it("uses the archive for old dates and no forecast beyond 15 days", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(openMeteoBody)));
    vi.stubGlobal("fetch", fetchMock);
    await openMeteoProvider.actualAt(33.9, -117.9, new Date(Date.now() - 200 * 86_400_000));
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("archive-api.open-meteo.com");
    expect(await openMeteoProvider.forecastAt(33.9, -117.9, new Date(Date.now() + 30 * 86_400_000))).toBeNull();
  });
});

describe("Google mapping", () => {
  it("maps a forecast hour", () => {
    const body = { forecastHours: [googleHour("2026-10-17T14:00:00Z"), googleHour("2026-10-17T15:00:00Z", { temperature: { degrees: 80, unit: "FAHRENHEIT" } })] };
    const c = mapGoogleHours(body, "forecastHours", TEE, "FORECAST")!;
    expect(c).toMatchObject({ provider: "google", tempF: 80, feelsLikeF: 71, windMph: 8, windGustMph: 14, windDir: "NW", precipChance: 15, precipIn: 0.01, humidity: 48, conditions: "Partly cloudy", icon: "cloud" });
  });
  it("returns null when no hour covers the time", () => {
    expect(mapGoogleHours({ forecastHours: [googleHour("2026-10-17T10:00:00Z")] }, "forecastHours", TEE, "FORECAST")).toBeNull();
    expect(mapGoogleHours({}, "historyHours", TEE, "ACTUAL")).toBeNull();
  });
  it("maps the current conditions body and condition types to icons", () => {
    const { interval, ...current } = googleHour("2026-10-17T15:00:00Z", { weatherCondition: { description: { text: "Thunderstorm" }, type: "THUNDERSTORM" } });
    void interval;
    const c = mapGoogleHour({ currentTime: "2026-10-17T15:05:00Z", ...current }, TEE, "ACTUAL")!;
    expect(c.icon).toBe("storm");
    expect(c.kind).toBe("ACTUAL");
  });
  it("calls the forecast endpoint with imperial units and follows pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ forecastHours: [googleHour("2026-10-17T08:00:00Z")], nextPageToken: "p2" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ forecastHours: [googleHour("2026-10-17T15:00:00Z")] })));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T08:00:00Z"));
    try {
      const c = await createGoogleProvider("KEY").forecastAt(33.9, -117.9, TEE);
      expect(c?.tempF).toBe(72.5);
    } finally {
      vi.useRealTimers();
    }
    const first = String(fetchMock.mock.calls[0][0]);
    expect(first).toContain("weather.googleapis.com/v1/forecast/hours:lookup");
    expect(first).toContain("unitsSystem=IMPERIAL");
    expect(first).toContain("key=KEY");
    expect(String(fetchMock.mock.calls[1][0])).toContain("pageToken=p2");
  });
  it("won't forecast past 240 hours or look back past 24", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const g = createGoogleProvider("KEY");
    expect(await g.forecastAt(1, 1, new Date(Date.now() + 20 * 86_400_000))).toBeNull();
    expect(await g.actualAt(1, 1, new Date(Date.now() - 3 * 86_400_000))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("errors never throw", () => {
  it("returns null on network failure, bad status and timeout", async () => {
    const soon = new Date(Date.now() + 3_600_000);
    const past = new Date(Date.now() - 3 * 3_600_000);
    const google = createGoogleProvider("KEY");
    for (const impl of [
      async () => {
        throw new Error("offline");
      },
      async () => new Response("nope", { status: 500 }),
      async () => new Response("not json", { status: 200 }),
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    ]) {
      vi.stubGlobal("fetch", vi.fn(impl));
      expect(await openMeteoProvider.forecastAt(1, 1, soon)).toBeNull();
      expect(await openMeteoProvider.actualAt(1, 1, past)).toBeNull();
      expect(await google.forecastAt(1, 1, soon)).toBeNull();
      expect(await google.actualAt(1, 1, past)).toBeNull();
    }
  });
});

describe("provider selection", () => {
  it("defaults to google with a key, open-meteo without", () => {
    expect(selectProviderName({ GOOGLE_WEATHER_API_KEY: "k" })).toBe("google");
    expect(selectProviderName({})).toBe("open-meteo");
    expect(selectProviderName({ GOOGLE_WEATHER_API_KEY: "  " })).toBe("open-meteo");
  });
  it("honours WEATHER_PROVIDER", () => {
    expect(selectProviderName({ WEATHER_PROVIDER: "fake", GOOGLE_WEATHER_API_KEY: "k" })).toBe("fake");
    expect(selectProviderName({ WEATHER_PROVIDER: "open-meteo", GOOGLE_WEATHER_API_KEY: "k" })).toBe("open-meteo");
    expect(selectProviderName({ WEATHER_PROVIDER: "google", GOOGLE_WEATHER_API_KEY: "k" })).toBe("google");
  });
  it("falls back to open-meteo when google is chosen without a key", () => {
    expect(selectProviderName({ WEATHER_PROVIDER: "google" })).toBe("open-meteo");
    expect(getProvider({ WEATHER_PROVIDER: "google" }).name).toBe("open-meteo");
    expect(getProvider({ GOOGLE_WEATHER_API_KEY: "k" }).name).toBe("google");
    expect(getProvider({ WEATHER_PROVIDER: "fake" }).name).toBe("fake");
  });
});

describe("fake provider", () => {
  it("is deterministic and plausible", async () => {
    const a = await fakeProvider.forecastAt(33.9, -117.9, TEE);
    const b = await fakeProvider.forecastAt(33.9, -117.9, TEE);
    expect(a).toEqual(b);
    expect(a!.tempF).toBeGreaterThan(20);
    expect(a!.tempF).toBeLessThan(120);
    expect(a!.kind).toBe("FORECAST");
    expect((await fakeProvider.actualAt(33.9, -117.9, TEE))!.kind).toBe("ACTUAL");
  });
});

describe("conditionsLabel", () => {
  const base = { kind: "FORECAST" as const, provider: "fake", forTime: TEE, tempF: 72.4, feelsLikeF: null, windMph: 8.2, windGustMph: null, windDir: "NW", precipChance: null, precipIn: null, humidity: null, conditions: "Partly cloudy", icon: "cloud" };
  it("formats", () => {
    expect(conditionsLabel(base)).toBe("72°F · Wind 8 mph NW · Partly cloudy");
    expect(conditionsLabel({ ...base, tempF: null, windMph: 0 })).toBe("Calm · Partly cloudy");
    expect(conditionsLabel({ ...base, windDir: null })).toBe("72°F · Wind 8 mph · Partly cloudy");
  });
});
