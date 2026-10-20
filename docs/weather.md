# Weather

Conditions are saved twice for every booked tee time:

- **FORECAST** when the tee time is booked (`snapshotForecast`). This is what the golfers saw.
- **ACTUAL** once the round is over, fetched lazily on the first view of the match or by the batch job (`refreshActuals`).

Both are `WeatherSnapshot` rows keyed to the reservation and/or the match, with `forTime` set to the tee time.
`conditionsFor({ reservationId, matchId })` returns the ACTUAL if there is one, otherwise the FORECAST, otherwise `null`.
A tee time counts as over one hour after it starts. If the provider has no actual yet, the lookup is not repeated for 30 minutes.

Nothing in here throws to callers. Network errors, timeouts (5 s), bad responses and missing keys all come back as `null`,
and a weather outage never blocks a booking.

## Providers

Choose with `WEATHER_PROVIDER` (`google`, `open-meteo` or `fake`). When unset, Google is used if `GOOGLE_WEATHER_API_KEY`
is set, otherwise Open-Meteo. Choosing `google` without a key falls back to Open-Meteo.

| Provider | Needs | Forecast reach | Actuals |
| --- | --- | --- | --- |
| `google` | `GOOGLE_WEATHER_API_KEY` | 240 hours ahead | past 24 hours only (current conditions when the time is now) |
| `open-meteo` | nothing (free, no key) | about 15 days | forecast API back 80 days, archive API for older |
| `fake` | nothing | any | any, deterministic from lat/lng/time (tests, demos, offline) |

### Google Weather API

1. Create a Google Cloud project and turn on billing.
2. Enable the **Weather API** for the project.
3. Create an API key (restrict it to the Weather API and to your server's IP) and set `GOOGLE_WEATHER_API_KEY`.

Endpoints used, all with `unitsSystem=IMPERIAL`: `forecast/hours:lookup`, `history/hours:lookup`, `currentConditions:lookup`
under `https://weather.googleapis.com/v1`. Because Google keeps only 24 hours of history, run the batch job at least daily
or the actual for an unviewed round is lost (the forecast is still shown).

### Open-Meteo

Free for non-commercial use, no key. Commercial use needs their paid plan, so switch to Google or a paid Open-Meteo key before
launch. Use it as the default while developing.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `WEATHER_PROVIDER` | `google`, `open-meteo` or `fake` |
| `GOOGLE_WEATHER_API_KEY` | Google Maps Platform key |
| `CRON_SECRET` | Bearer secret for `POST /api/weather/refresh` (route is closed when unset) |

## Batch job

`POST /api/weather/refresh` with `Authorization: Bearer $CRON_SECRET` saves the actual for every confirmed reservation and
match whose tee time ended in the last 7 days and has none yet. Returns `{ "saved": n }`. Call it hourly from any scheduler.

## Using it

```ts
import { conditionsFor, forecastFor } from "@/lib/weather";
import { WeatherBadge } from "@/components/WeatherBadge";
import { WeatherCard } from "@/components/WeatherCard";

const now = await conditionsFor({ matchId });
<WeatherBadge conditions={now} />
<WeatherCard conditions={now} forecast={await forecastFor({ matchId })} />
```

`snapshotForecast({ reservationId, matchId? })` is called at booking (and again when a match is attached; it only fills in
the missing link and never saves a second forecast).

Demo data: `prisma/seed/30-weather.ts` saves fake forecasts for every seeded reservation and match, and actuals for tee times
already past.
