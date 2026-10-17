// Weather at the course for a tee time. Owned by the weather worker; signatures are the contract.

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

/** Saves the forecast for a booked tee time. Never throws: a weather outage must not block a booking. */
export async function snapshotForecast(input: { reservationId: string; matchId?: string | null }): Promise<void> {
  void input;
}

/** Best conditions known for a match or reservation: ACTUAL once the round is over, otherwise the FORECAST. Fetches the actual lazily after the tee time. */
export async function conditionsFor(input: { reservationId?: string | null; matchId?: string | null }): Promise<Conditions | null> {
  void input;
  return null;
}
