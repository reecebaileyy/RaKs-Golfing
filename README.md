# RaKs Golfing

> A tee time booking platform that lets everyday golfers compete against one another
> for cash, based on their handicap and three most recent rounds.

This first milestone is the **booking baseline**: find a tee time, hold it, check
out and manage the reservation, on a phone-sized screen first. How it maps to
GolfNow's flow is in [docs/booking-flow.md](docs/booking-flow.md).

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS 4, Prisma (SQLite locally),
Zod, Vitest and Playwright. It's a mobile-first web app. The JSON API under
`/api` is what a future native app would call too.

## Run it

```bash
npm install
echo 'DATABASE_URL="file:./dev.db"' > .env
npx prisma db push
npm run db:seed      # four demo courses, tee times for the next 10 days
npm run dev          # http://localhost:3000
```

Open it in your browser's phone emulator, or on your phone over your LAN.

## Tests

```bash
npm test             # pricing, cancellation and time zone rules
npm run test:e2e     # builds, then books and cancels on an iPhone 13 viewport
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

## Not in this milestone

Accounts and sign-in, real payments (Stripe Connect), partner tee sheet
integrations, and the competition features (handicaps, recent rounds, cash prizes).
