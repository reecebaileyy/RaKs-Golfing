// Shared weather types. Kept free of imports so providers, the db layer and tests can all use them.

export interface Conditions {
  kind: "FORECAST" | "ACTUAL";
  provider: string;
  forTime: Date;
  tempF: number | null;
  feelsLikeF: number | null;
  windMph: number | null;
  windGustMph: number | null;
  windDir: string | null;
  precipChance: number | null;
  precipIn: number | null;
  humidity: number | null;
  conditions: string;
  icon: string | null;
}

export type WeatherIcon = "sun" | "cloud" | "rain" | "wind" | "fog" | "storm" | "snow";

export interface WeatherProvider {
  name: string;
  /** Predicted conditions at `time`; null when the provider has none (too far ahead, outage, no key). */
  forecastAt(lat: number, lng: number, time: Date): Promise<Conditions | null>;
  /** Observed conditions at `time`; null when unavailable. */
  actualAt(lat: number, lng: number, time: Date): Promise<Conditions | null>;
}
