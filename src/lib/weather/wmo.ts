// WMO weather interpretation codes (used by Open-Meteo) mapped to text and a UI icon.
import type { WeatherIcon } from "./types";

const TABLE: Record<number, [string, WeatherIcon]> = {
  0: ["Clear sky", "sun"],
  1: ["Mostly clear", "sun"],
  2: ["Partly cloudy", "cloud"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "rain"],
  53: ["Drizzle", "rain"],
  55: ["Heavy drizzle", "rain"],
  56: ["Freezing drizzle", "rain"],
  57: ["Heavy freezing drizzle", "rain"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Heavy freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rain"],
  81: ["Showers", "rain"],
  82: ["Heavy showers", "rain"],
  85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm with hail", "storm"],
  99: ["Severe thunderstorm with hail", "storm"],
};

export function describeWmo(code: number | null | undefined): { text: string; icon: WeatherIcon | null } {
  const hit = code == null ? undefined : TABLE[code];
  return hit ? { text: hit[0], icon: hit[1] } : { text: "Unknown", icon: null };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 16-point compass label for a wind direction in degrees. */
export function degreesToCardinal(deg: number | null | undefined): string | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
