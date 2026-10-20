// Open-Meteo: free, no key. Forecast API covers about 16 days ahead and 92 days back; the archive API covers older dates.
import { describeWmo, degreesToCardinal } from "../wmo";
import { getJson, num, roundToHour, HOUR_MS } from "../http";
import type { Conditions, WeatherProvider } from "../types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "relative_humidity_2m",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const ARCHIVE_HOURLY = HOURLY.filter((h) => h !== "precipitation_probability");
const UNITS = "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=UTC";
const DAY_MS = 24 * HOUR_MS;

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Series = Record<string, unknown>;

function at(series: Series, key: string, i: number): number | null {
  const col = series[key];
  return Array.isArray(col) ? num(col[i]) : null;
}

/** Turns an Open-Meteo response into Conditions for the hour nearest `time`. Null when that hour is missing. */
export function mapOpenMeteo(body: unknown, time: Date, kind: Conditions["kind"]): Conditions | null {
  const hourly = (body as { hourly?: Series } | null)?.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) return null;
  const target = roundToHour(time);
  // timezone=UTC makes the stamps "2026-10-17T14:00" with no zone suffix.
  const i = times.findIndex((t) => typeof t === "string" && Date.parse(t.endsWith("Z") ? t : `${t}Z`) === target);
  if (i < 0) return null;
  const code = at(hourly, "weather_code", i);
  const temp = at(hourly, "temperature_2m", i);
  if (temp == null && code == null) return null;
  const { text, icon } = describeWmo(code);
  const wind = at(hourly, "wind_speed_10m", i);
  return {
    kind,
    provider: "open-meteo",
    forTime: time,
    tempF: temp,
    feelsLikeF: at(hourly, "apparent_temperature", i),
    windMph: wind,
    windGustMph: at(hourly, "wind_gusts_10m", i),
    windDir: degreesToCardinal(at(hourly, "wind_direction_10m", i)),
    precipChance: at(hourly, "precipitation_probability", i),
    precipIn: at(hourly, "precipitation", i),
    humidity: at(hourly, "relative_humidity_2m", i),
    conditions: text,
    icon: wind != null && wind >= 20 && (icon === "sun" || icon === "cloud") ? "wind" : icon,
  };
}

async function fetchHour(lat: number, lng: number, time: Date, kind: Conditions["kind"]): Promise<Conditions | null> {
  const now = Date.now();
  const target = roundToHour(time);
  const loc = `latitude=${lat}&longitude=${lng}`;
  let url: string;
  if (kind === "FORECAST") {
    const daysAhead = Math.ceil((target - now) / DAY_MS);
    if (daysAhead > 15) return null;
    url = `${FORECAST_URL}?${loc}&hourly=${HOURLY.join(",")}&${UNITS}&forecast_days=${Math.max(1, daysAhead + 1)}`;
  } else if (now - target <= 80 * DAY_MS) {
    const daysBack = Math.max(0, Math.ceil((now - target) / DAY_MS));
    url = `${FORECAST_URL}?${loc}&hourly=${HOURLY.join(",")}&${UNITS}&past_days=${daysBack + 1}&forecast_days=1`;
  } else {
    url = `${ARCHIVE_URL}?${loc}&hourly=${ARCHIVE_HOURLY.join(",")}&${UNITS}&start_date=${ymd(target)}&end_date=${ymd(target)}`;
  }
  return mapOpenMeteo(await getJson(url), time, kind);
}

export const openMeteoProvider: WeatherProvider = {
  name: "open-meteo",
  forecastAt: (lat, lng, time) => fetchHour(lat, lng, time, "FORECAST"),
  actualAt: (lat, lng, time) => fetchHour(lat, lng, time, "ACTUAL"),
};
