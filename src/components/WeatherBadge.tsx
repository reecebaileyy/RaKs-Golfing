import { conditionsLabel, type Conditions } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/** One-line weather summary. Renders nothing when there are no conditions. */
export function WeatherBadge({ conditions }: { conditions: Conditions | null }) {
  if (!conditions) return null;
  const label = conditionsLabel(conditions);
  const title = conditions.kind === "FORECAST" ? "Forecast when booked" : "Conditions at tee time";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted" title={title}>
      <WeatherIcon icon={conditions.icon} className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
