# Changelog

Every release of RaKs Golfing, newest first. Each version is a git tag and a
GitHub release. How to cut one: [docs/releasing.md](docs/releasing.md).

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
