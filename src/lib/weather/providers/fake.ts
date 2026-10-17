// Deterministic made-up weather for tests, demos and offline use. Same inputs always give the same answer.
import { describeWmo, degreesToCardinal } from "../wmo";
import { roundToHour, HOUR_MS } from "../http";
import type { Conditions, WeatherProvider } from "../types";

function hash(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= Math.floor(p * 1000) & 0x7fffffff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

const unit = (h: number) => (h % 10000) / 10000;

const CODES = [0, 0, 1, 1, 2, 2, 3, 3, 45, 61, 80, 95];

function build(kind: Conditions["kind"], lat: number, lng: number, time: Date): Conditions {
  const t = roundToHour(time);
  // The observed hour differs a little from the forecast one, as it does in life.
  const salt = kind === "ACTUAL" ? 7 : 0;
  const day = Math.floor(t / (24 * HOUR_MS));
  const localHour = (((t / HOUR_MS + lng / 15) % 24) + 24) % 24;
  const month = new Date(t).getUTCMonth();
  const seasonal = 62 + 16 * Math.sin(((month - 3) / 12) * 2 * Math.PI) - Math.abs(lat - 34) * 0.4;
  const diurnal = 9 * Math.sin(((localHour - 9) / 24) * 2 * Math.PI);
  const wobble = (unit(hash(lat, lng, day)) - 0.5) * 12 + (kind === "ACTUAL" ? (unit(hash(lat, lng, t, salt)) - 0.5) * 4 : 0);
  const tempF = Math.round((seasonal + diurnal + wobble) * 10) / 10;
  const code = CODES[hash(lat, lng, day, 3) % CODES.length];
  const { text, icon } = describeWmo(code);
  const windMph = Math.round(3 + unit(hash(lat, lng, t, 11 + salt)) * 14);
  const wet = icon === "rain" || icon === "storm";
  return {
    kind,
    provider: "fake",
    forTime: new Date(t),
    tempF,
    feelsLikeF: Math.round((tempF - (windMph > 12 ? 2 : 0)) * 10) / 10,
    windMph,
    windGustMph: windMph + 3 + (hash(lat, lng, t, 5) % 8),
    windDir: degreesToCardinal(unit(hash(lat, lng, day, 13)) * 360),
    precipChance: wet ? 60 + (hash(lat, lng, t, 17) % 35) : hash(lat, lng, t, 17) % 15,
    precipIn: wet ? Math.round(unit(hash(lat, lng, t, 19)) * 30) / 100 : 0,
    humidity: Math.round(35 + unit(hash(lat, lng, day, 23)) * 45),
    conditions: text,
    icon: windMph >= 15 && (icon === "sun" || icon === "cloud") ? "wind" : icon,
  };
}

export const fakeProvider: WeatherProvider = {
  name: "fake",
  forecastAt: async (lat, lng, time) => build("FORECAST", lat, lng, time),
  actualAt: async (lat, lng, time) => build("ACTUAL", lat, lng, time),
};
