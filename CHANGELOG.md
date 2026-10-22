# Changelog

Every release of RaKs Golfing, newest first. Each version is a git tag and a
GitHub release. How to cut one: [docs/releasing.md](docs/releasing.md).

## 0.3.0 (2026-10-22): the waitlist

A landing page with a waitlist to measure demand before launch, ready to host
on your own domain.

### Added
- **Waitlist landing page** at `/waitlist`, and at `/` when `SITE_MODE=waitlist`
  closes the rest of the app. Golfers join with X, TikTok, Instagram, email or
  phone; an email or phone number is always required. Optional ZIP code and how
  often they play. Each golfer gets their spot in line and an invite link.
- **Accounts without passwords**: every sign-up is a real account tied to the
  login the golfer picked, so it's there on launch day. Sign in with a one-time
  code by email (Resend) or text (Twilio), or with the same social login.
  Connect more social logins from the spot card.
- **Golf talk wall**: signed-up golfers post short golf takes; no links, rate
  limited, admins can hide posts.
- **Demand dashboard** at `/admin/waitlist`: totals, a 30 day chart, sign-ups by
  login, source (UTM tags and invite links), how often they play and ZIP code,
  comment moderation and a CSV export.
- **Privacy and terms pages**, needed for the social login app reviews.
- **Hosting**: Postgres instead of SQLite, a migration, and a Vercel config.
  Steps in [docs/hosting.md](docs/hosting.md); the waitlist itself is in
  [docs/waitlist.md](docs/waitlist.md). Works with Neon or Prisma Postgres:
  the build falls back to `DATABASE_URL` when `DATABASE_URL_UNPOOLED` isn't set.

### Changed
- An account's email is now optional when it has a phone number. Booking asks
  for an email first, since course confirmations and receipts go there.
- Local development and tests need a Postgres database (see the README).

### Fixed
- Races that SQLite hid and Postgres would expose: two withdrawals at once
  could both pass the balance check, the last two players confirming at once
  left the match unsettled, a score edit could land on a card that was
  settling, and a second simultaneous dispute was refused. Each has a test.

### Not real yet
- The site isn't hosted yet; [docs/hosting.md](docs/hosting.md) lists the
  account and DNS steps.
- Social logins need their own apps: X charges per sign-in, TikTok must
  approve the app, and Instagram only signs in business or creator accounts.
- Texted sign-in codes need Twilio and US carrier registration. Until then,
  golfers who joined with only a phone number keep their spot but can't sign
  back in.
- The privacy and terms pages are plain-language drafts with no legal review.

## 0.2.0 (2026-10-20): the whole app

Golfers can now sign in, build a profile, book a tee time with a wagered match,
play it with live scoring, and climb the leaderboard.

### Added
- **Accounts**: email and password sign-in.
- **Profiles**: start from a GHIN number or five score cards. Handicap Index
  follows the World Handicap System. The verified badge appears once an admin
  checks the GHIN number and the golfer has rounds entered. Profiles show
  stats, a differential trend, courses played, match record, and the weather on
  each competition day.
- **Matches at booking** (required, minimum $20 wager): 1v1 and 2v2 best ball,
  stroke or match play, the nine point game ($1/$3/$5 per point by group vote),
  and threesome matches. Net or gross is agreed before booking. Friends join by
  invite link, or anyone can take an open challenge.
- **Money**: wager holds at booking and on a press, a double-entry ledger, a
  wallet with history and a demo withdraw. A match nobody joins 2 hours before
  the tee time is void: the wager is refunded and the tee time kept. Cancelling
  a booking refunds every wager. The platform takes no cut.
- **Game screen**: location picks the hole you're on, anyone in the group enters
  scores, the match status updates per hole, then everyone confirms or disputes
  the card. Disputed money stays held for an admin.
- **ALOHA PRESS**: double or nothing for the side that's down. Match play: any
  remaining hole once the match is closed out, or the last hole. Stroke play:
  the last hole.
- **Live scorecards** anyone can watch without an account, updated as scores
  are entered.
- **Leaderboard** with rankings on win/loss (35%), strength of opponents (35%),
  scoring against course difficulty (15%) and wagering profit (15%).
- **Weather** saved when a tee time is booked and at the round (Google Weather,
  Open-Meteo, or a fake provider offline).
- Docs: [game rules](docs/game-rules.md), [wagers](docs/wagers.md),
  [weather](docs/weather.md), [architecture](docs/README.md).

### Not real yet
- Payments use a fake card provider, pending a gaming lawyer and an approved
  processor.
- GHIN has no live lookup until the USGA licenses access; admins verify by hand.
- Demo courses have made-up hole coordinates.

## 0.1.0 (2026-10-17): booking baseline

### Added
- Tee time search, 5-minute holds, checkout and cancellation, modeled on how
  GolfNow sells tee times ([docs/booking-flow.md](docs/booking-flow.md)).
- Per-rate booking fees and golfer limits, Hot Deals (prepaid), Tee Time
  Protection, and per-course cancellation windows.
- Mobile-first layout, demo courses and tee times.
