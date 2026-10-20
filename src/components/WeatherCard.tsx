import { conditionsLabel, type Conditions } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

const deg = (n: number | null) => (n == null ? "-" : `${Math.round(n)}°F`);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function windText(c: Conditions): string {
  if (c.windMph == null) return "-";
  const gust = c.windGustMph != null && c.windGustMph > c.windMph ? `, gusts ${Math.round(c.windGustMph)}` : "";
  return `${Math.round(c.windMph)} mph${c.windDir ? ` ${c.windDir}` : ""}${gust}`;
}

function rainText(c: Conditions): string {
  if (c.precipChance == null && c.precipIn == null) return "-";
  const chance = c.precipChance != null ? `${Math.round(c.precipChance)}%` : "";
  const amount = c.precipIn != null && c.precipIn > 0 ? `${c.precipIn.toFixed(2)} in` : "";
  return [chance, amount].filter(Boolean).join(" · ") || "None";
}

/**
 * Weather for a tee time. Pass the saved forecast alongside an actual to show how the day compared
 * with what the golfer saw when booking.
 */
export function WeatherCard({ conditions, forecast }: { conditions: Conditions | null; forecast?: Conditions | null }) {
  if (!conditions) return null;
  const isActual = conditions.kind === "ACTUAL";
  const showForecast = isActual && forecast && forecast.kind === "FORECAST";
  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <WeatherIcon icon={conditions.icon} className="h-9 w-9 shrink-0 text-fairway-600" />
        <div>
          <p className="text-2xl font-semibold leading-none">{deg(conditions.tempF)}</p>
          <p className="mt-1 text-sm text-muted">{conditions.conditions}</p>
        </div>
      </div>
      <dl className="mt-3 divide-y divide-line">
        <Row label="Feels like" value={deg(conditions.feelsLikeF)} />
        <Row label="Wind" value={windText(conditions)} />
        <Row label={isActual ? "Rain" : "Chance of rain"} value={rainText(conditions)} />
        <Row label="Humidity" value={conditions.humidity == null ? "-" : `${Math.round(conditions.humidity)}%`} />
      </dl>
      {showForecast && <p className="mt-3 text-xs text-muted">Forecast when booked: {conditionsLabel(forecast)}</p>}
      <p className="mt-3 text-xs text-muted">{isActual ? "Conditions at tee time" : "Forecast saved when booked"}</p>
    </section>
  );
}
