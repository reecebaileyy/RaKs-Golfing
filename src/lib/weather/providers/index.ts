// Provider selection. WEATHER_PROVIDER = google | open-meteo | fake; unset means google when a key exists, else open-meteo.
import type { WeatherProvider } from "../types";
import { createGoogleProvider } from "./google";
import { openMeteoProvider } from "./openMeteo";
import { fakeProvider } from "./fake";

export type ProviderName = "google" | "open-meteo" | "fake";

export function selectProviderName(env: Record<string, string | undefined> = process.env): ProviderName {
  const key = env.GOOGLE_WEATHER_API_KEY?.trim();
  const wanted = env.WEATHER_PROVIDER?.trim().toLowerCase();
  if (wanted === "fake") return "fake";
  if (wanted === "open-meteo" || wanted === "openmeteo") return "open-meteo";
  // Google without a key can't answer anything, so fall back to the free provider.
  return key ? "google" : "open-meteo";
}

export function getProvider(env: Record<string, string | undefined> = process.env): WeatherProvider {
  const name = selectProviderName(env);
  if (name === "fake") return fakeProvider;
  if (name === "google") return createGoogleProvider(env.GOOGLE_WEATHER_API_KEY!.trim());
  return openMeteoProvider;
}

export { fakeProvider, openMeteoProvider, createGoogleProvider };
