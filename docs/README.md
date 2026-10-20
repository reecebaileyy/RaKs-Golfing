# RaKs Golfing docs

Start with the [README](../README.md) to run the app. Release history is in
[CHANGELOG.md](../CHANGELOG.md).

| Doc | What it covers |
| --- | --- |
| [game-rules.md](game-rules.md) | Handicaps, strokes, formats, the ALOHA PRESS, settlement and rankings |
| [wagers.md](wagers.md) | Where a golfer's money is at each step, and the ledger |
| [booking-flow.md](booking-flow.md) | The tee time booking flow and how it maps to GolfNow |
| [weather.md](weather.md) | Weather providers, keys and when conditions are saved |
| [releasing.md](releasing.md) | How to cut a release |

## How the code is laid out

A Next.js 15 App Router app in TypeScript with Prisma on SQLite. Pages are
server components that read through `src/lib`; the JSON API under
`src/app/api` serves the client components and a future native app.

| Path | What lives there |
| --- | --- |
| `prisma/schema.prisma` | The whole data model, with comments |
| `prisma/seed.ts`, `prisma/seed/*.ts` | Demo courses, golfers, matches, history and weather |
| `src/lib/auth.ts` | Email and password sign-in, database sessions |
| `src/lib/booking.ts`, `pricing.ts`, `cancellation.ts`, `teesheet.ts` | Tee time search, holds, checkout, cancel |
| `src/lib/golf/` | Pure golf rules: handicaps, scoring, press, settlement |
| `src/lib/wagers/` | Matches, ledger, holds, refunds, settlement, wallet |
| `src/lib/live.ts`, `geo.ts` | Game screen and live scorecard data, hole detection |
| `src/lib/profile.ts`, `stats.ts`, `profileData.ts` | Handicap choice, verification, profile stats |
| `src/lib/ranking.ts`, `rankingMath.ts` | Leaderboard and the ranking formula |
| `src/lib/weather/` | Weather providers and snapshots |
| `src/lib/payments.ts` | The card provider boundary (fake for now) |

## Pages

`/` book · `/matches` and `/matches/[code]` lobby · `/play/[code]` game screen ·
`/live` and `/live/[code]` public scorecards · `/leaderboard` · `/profile`,
`/golfers/[id]` · `/onboarding`, `/scorecards/new` · `/wallet` ·
`/reservations` · `/admin/verify`.

## Outside services

| Service | Status |
| --- | --- |
| Payments | Fake provider. Needs a gaming lawyer, then a processor approved for skill gaming. |
| USGA GHIN | No public API; needs a USGA license. Admins verify by hand. |
| Weather | Google Weather with `GOOGLE_WEATHER_API_KEY`, else Open-Meteo (free). |
| Hole maps | Stored per course in the database; import once (script, admin pins or a paid OSM provider), never fetched live. |
| Tee sheets | Behind `src/lib/teesheet.ts`; only our own sheet so far. |
