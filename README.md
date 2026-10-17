# RaKs Golfing

> A tee time booking platform that lets everyday golfers compete against one another
> for cash, based on their handicap and three most recent rounds.

Golfers book a tee time with a wagered match attached (minimum $20), play it
with live hole-by-hole scoring, and climb a leaderboard. What's in the app:

- **Booking** modeled on GolfNow: search, 5-minute hold, checkout, cancel
  ([docs/booking-flow.md](docs/booking-flow.md)).
- **Accounts and profiles**: GHIN number or five score cards, World Handicap
  System index, verified badge after an admin checks GHIN, stats, courses played
  and the conditions on each competition day.
- **Matches and wagers**: 1v1 and 2v2 best ball, stroke or match play, the nine
  point game and threesome matches; net or gross agreed at booking; invites and
  open challenges; money held in a double-entry ledger with a fake card provider
  ([docs/wagers.md](docs/wagers.md)).
- **Game screen**: location picks the hole, anyone in the group enters scores,
  the ALOHA PRESS, confirm or dispute the card, then payout.
- **Live scorecards** anyone can watch without an account, and a **leaderboard**
  ranked on win/loss (35%), strength of opponents (35%), scoring (15%) and
  profit (15%).
- **Weather** saved at booking and at the round ([docs/weather.md](docs/weather.md)).

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS 4, Prisma (SQLite locally),
Zod, Vitest and Playwright. It's a mobile-first web app. The JSON API under
`/api` is what a future native app would call too.

## Run it

```bash
npm install
echo 'DATABASE_URL="file:./dev.db"' > .env
npx prisma db push
npm run db:seed      # demo courses, tee times, golfers, matches and history
npm run dev          # http://localhost:3000
```

Open it in your browser's phone emulator, or on your phone over your LAN.
Demo golfers all use the password `golf1234`: reece@example.com (admin),
maya@, jordan@, sam@ and alex@example.com. `npm run sweep` voids matches
nobody joined in time.

## Tests

```bash
npm test             # handicaps, scoring, presses, payouts, ledger, rankings, weather
npm run test:e2e     # builds, then plays the app end to end on an iPhone 13 viewport
```

In a sandbox with a preinstalled Chromium, set `PW_CHROMIUM_PATH` to its path.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/tee-times?date=YYYY-MM-DD&players&holes&time&hotDeals&maxPrice&q` | Search |
| POST | `/api/holds` `{ rateId, players }` | Hold spots for 5 minutes (409 with `alternatives` if gone) |
| DELETE | `/api/holds/:id` | Release a hold |
| POST | `/api/reservations` `{ holdId, golfer, withProtection, acceptedPolicies }` | Check out |
| GET | `/api/reservations?email=` | A golfer's reservations |
| POST | `/api/reservations/:code/cancel` | Cancel, refunding per policy |

## Not built yet

Real payments (needs a gaming lawyer and an approved processor first), USGA GHIN
lookup (needs a USGA license; admins verify by hand until then), real hole maps
(courses get tee and green points imported once, not fetched live), partner tee
sheet integrations, and a native app for background location.
