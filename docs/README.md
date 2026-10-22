# RaKs Golfing docs

Start with the [README](../README.md) to run the app. Release history is in
[CHANGELOG.md](../CHANGELOG.md).

| Doc | What it covers |
| --- | --- |
| [hosting.md](hosting.md) | Putting the site online: Vercel, Neon, your domain, email codes |
| [waitlist.md](waitlist.md) | The pre-launch waitlist, sign-up options, social login setup, the demand dashboard |
| [game-rules.md](game-rules.md) | Handicaps, strokes, formats, the ALOHA PRESS, settlement and rankings |
| [wagers.md](wagers.md) | Where a golfer's money is at each step, and the ledger |
| [booking-flow.md](booking-flow.md) | The tee time booking flow and how it maps to GolfNow |
| [weather.md](weather.md) | Weather providers, keys and when conditions are saved |
| [releasing.md](releasing.md) | How to cut a release |

## How the code is laid out

A Next.js 15 App Router app in TypeScript with Prisma on Postgres. Pages are
server components that read through `src/lib`; the JSON API under
`src/app/api` serves the client components and a future native app.

| Path | What lives there |
| --- | --- |
| `prisma/schema.prisma` | The whole data model, with comments |
| `prisma/seed.ts`, `prisma/seed/*.ts` | Demo courses, golfers, matches, history and weather |
| `src/lib/auth.ts` | Database sessions, email and password sign-in |
| `src/lib/loginCodes.ts`, `messaging.ts`, `contact.ts` | One-time sign-in codes by email or text, phone and email rules |
| `src/lib/oauth/` | X, TikTok and Instagram sign-in, and the test-mode stand-in |
| `src/lib/waitlist.ts`, `waitlistMath.ts` | Joining, spot in line, referrals, the comment wall, dashboard numbers, CSV |
| `src/lib/siteMode.ts`, `src/middleware.ts` | `SITE_MODE=waitlist` routing, invite and UTM cookies |
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
`/reservations` · `/admin/verify`. Waitlist: `/waitlist`, `/join/finish`,
`/signin`, `/admin/waitlist`, `/privacy`, `/terms`.

## Outside services

| Service | Status |
| --- | --- |
| Payments | Fake provider. Needs a gaming lawyer, then a processor approved for skill gaming. |
| USGA GHIN | No public API; needs a USGA license. Admins verify by hand. |
| Weather | Google Weather with `GOOGLE_WEATHER_API_KEY`, else Open-Meteo (free). |
| Hole maps | Stored per course in the database; import once (script, admin pins or a paid OSM provider), never fetched live. |
| Tee sheets | Behind `src/lib/teesheet.ts`; only our own sheet so far. |
| Hosting | Vercel and Neon Postgres ([hosting.md](hosting.md)). |
| Sign-in codes | Resend for email, Twilio for texts; logged to the server console when unset. |
| Social logins | X, TikTok, Instagram (professional accounts only); each needs its own app ([waitlist.md](waitlist.md)). |
