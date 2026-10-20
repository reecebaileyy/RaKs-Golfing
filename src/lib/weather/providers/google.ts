// Google Maps Platform Weather API (weather.googleapis.com/v1). Needs GOOGLE_WEATHER_API_KEY.
// Forecast hours reach 240 h ahead; history hours cover the past 24 h only.
import { getJson, num, HOUR_MS } from "../http";
import type { Conditions, WeatherProvider } from "../types";

const BASE = "https://weather.googleapis.com/v1";
const MAX_FORECAST_HOURS = 240;
const MAX_PAGES = 12;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

/** NORTH_NORTHWEST -> NNW */
function cardinal(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return v
    .split("_")
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function iconFor(type: unknown): string | null {
  if (typeof type !== "string") return null;
  if (/THUNDER/.test(type)) return "storm";
  if (/SNOW|SLEET|HAIL|BLIZZARD|FLURR|WINTRY/.test(type)) return "snow";
  if (/RAIN|SHOWER|DRIZZLE/.test(type)) return "rain";
  if (/FOG|HAZE|MIST|SMOKE/.test(type)) return "fog";
  if (/WINDY/.test(type)) return "wind";
  if (/CLEAR|SUNNY/.test(type)) return "sun";
  if (/CLOUD/.test(type)) return "cloud";
  return null;
}

const degrees = (v: unknown) => num(obj(v)?.degrees);

/** Maps one Google hour (a forecastHours / historyHours entry or a currentConditions body) to Conditions. */
export function mapGoogleHour(hour: unknown, time: Date, kind: Conditions["kind"]): Conditions | null {
  const h = obj(hour);
  if (!h) return null;
  const cond = obj(h.weatherCondition);
  const wind = obj(h.wind);
  const precip = obj(h.precipitation);
  const text = obj(cond?.description)?.text;
  const temp = degrees(h.temperature);
  if (temp == null && typeof text !== "string") return null;
  return {
    kind,
    provider: "google",
    forTime: time,
    tempF: temp,
    feelsLikeF: degrees(h.feelsLikeTemperature),
    windMph: num(obj(wind?.speed)?.value),
    windGustMph: num(obj(wind?.gust)?.value),
    windDir: cardinal(obj(wind?.direction)?.cardinal),
    precipChance: num(obj(obj(precip?.probability))?.percent),
    precipIn: num(obj(precip?.qpf)?.quantity),
    humidity: num(h.relativeHumidity),
    conditions: typeof text === "string" && text ? text : "Unknown",
    icon: iconFor(cond?.type),
  };
}

/** Picks the hour whose interval contains `time` out of a list of Google hours. */
function pickHour(hours: unknown, time: Date): unknown | null {
  if (!Array.isArray(hours)) return null;
  const t = time.getTime();
  for (const h of hours) {
    const iv = obj(obj(h)?.interval);
    const start = typeof iv?.startTime === "string" ? Date.parse(iv.startTime) : NaN;
    const end = typeof iv?.endTime === "string" ? Date.parse(iv.endTime) : start + HOUR_MS;
    if (start <= t && t < end) return h;
  }
  return null;
}

/** Maps a forecast/history response body (one page) for `time`; null when no hour in the page covers it. */
export function mapGoogleHours(body: unknown, key: "forecastHours" | "historyHours", time: Date, kind: Conditions["kind"]): Conditions | null {
  return mapGoogleHour(pickHour(obj(body)?.[key], time), time, kind);
}

export function createGoogleProvider(apiKey: string): WeatherProvider {
  const loc = (lat: number, lng: number) => `key=${encodeURIComponent(apiKey)}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=IMPERIAL`;

  async function pages(path: string, key: "forecastHours" | "historyHours", lat: number, lng: number, hours: number, time: Date, kind: Conditions["kind"]) {
    let token = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${BASE}/${path}?${loc(lat, lng)}&hours=${hours}&pageSize=24${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
      const body = await getJson(url);
      if (!body) return null;
      const hit = mapGoogleHours(body, key, time, kind);
      if (hit) return hit;
      const next = obj(body)?.nextPageToken;
      if (typeof next !== "string" || !next) return null;
      token = next;
    }
    return null;
  }

  return {
    name: "google",
    async forecastAt(lat, lng, time) {
      const ahead = Math.ceil((time.getTime() - Date.now()) / HOUR_MS) + 1;
      if (ahead > MAX_FORECAST_HOURS) return null;
      return pages("forecast/hours:lookup", "forecastHours", lat, lng, Math.max(1, ahead), time, "FORECAST");
    },
    async actualAt(lat, lng, time) {
      const ago = (Date.now() - time.getTime()) / HOUR_MS;
      if (ago > 24) return null;
      if (ago < 0.5) {
        const body = await getJson(`${BASE}/currentConditions:lookup?${loc(lat, lng)}`);
        return mapGoogleHour(body, time, "ACTUAL");
      }
      return pages("history/hours:lookup", "historyHours", lat, lng, 24, time, "ACTUAL");
    },
  };
}
