# Wagers: how the money moves

Every tee time booked on RaKs Golfing is a match played for money. This page
explains, in plain words, where a golfer's money is at each step and how our
ledger records it. Code: `src/lib/wagers/` (`matches.ts`, `round.ts`,
`ledger.ts`) and the golf rules in `src/lib/golf/`.

All money is demo money for now: cards go through the fake provider in
`src/lib/payments.ts` and nothing real is charged. Amounts are whole cents.

## The short version

1. **Booking.** The booker pays the booking fee (and any prepaid green fees)
   plus their **wager hold** in one charge. The hold is the most they can lose
   before any press: the stake for 1v1, best ball and nine point (where the
   stake is the loss cap), and twice the stake for threesomes (two opponents).
2. **Joining.** Each player who joins pays their own wager hold. Anyone can
   leave for a full refund until the match is full.
3. **READY.** When every spot is filled and everyone accepted the terms, the
   match locks: each player's handicap index, verified badge, course and
   playing handicap, and strokes per hole are frozen. Nine point: the point
   value is the group vote (majority, or the lowest of three different votes).
4. **Nobody joined.** If an open match isn't full 2 hours before the tee time,
   it is **VOID**: every hold is refunded and the tee time stays booked.
5. **Booking cancelled.** If the match hasn't started (OPEN or READY), it is
   **CANCELLED** and every player's hold is refunded in full.
6. **Press.** The side that's down can call the ALOHA PRESS. Every player on
   that side has one more stake held (they could now lose double).
7. **Finish.** After 18 holes the match waits for every player to confirm the
   card. Then it **settles**: each player's hold is released, losers' money goes
   to the winners, and everyone's share lands in their **wallet**.
8. **Dispute.** Anyone can dispute the card while it's live or being confirmed.
   The money stays held until an admin settles it on the corrected card or
   voids it and refunds everyone (presses included).
9. **Wallet.** Winnings and returned holds sit in the wallet until the golfer
   withdraws them to their bank (fake for now).

We take no cut of wagers. Our revenue is the booking fee.

## Match states

```
OPEN ──(all spots paid)──> READY ──(first score)──> LIVE ──(18 holes in)──> CONFIRMING ──(all confirm)──> SETTLED
  │                          │                        │                         │
  │ 2h before, not full      │ booking cancelled      └───── dispute ───────────┴──> DISPUTED ──> SETTLED (admin)
  ▼                          ▼                                                                 └──> VOID (admin refund)
 VOID                     CANCELLED          (OPEN can also be CANCELLED by cancelling the booking)
```

If a score is changed while CONFIRMING, every confirmation is cleared so the
group confirms the new card.

## The ledger

Every movement of money is one **transaction**: a set of `LedgerEntry` rows
sharing a `txId` that add up to exactly zero. Accounts:

| Account | Meaning |
| --- | --- |
| `EXTERNAL` | Money outside the app: cards charged (negative) and money sent back out (positive). |
| `HELD` (per user, per match) | A player's money held for a match. |
| `WALLET` (per user) | A player's withdrawable balance. |
| `PLATFORM` | Our revenue. Not used by wagers. |

| Event | Kind | Entries |
| --- | --- | --- |
| Booking or join hold of X | `WAGER_HOLD` | EXTERNAL −X, HELD(player) +X |
| Press hold of X per presser | `PRESS_HOLD` | EXTERNAL −X, HELD(presser) +X (one tx per presser) |
| Refund (void, cancel, leave, admin) | `REFUND` | HELD(player) −held, EXTERNAL +held |
| Settlement | `SETTLE` | for each player: HELD −held, WALLET +(held + result). Results sum to zero, so the tx does too. |
| Withdraw X | `WITHDRAW` | WALLET −X, EXTERNAL +X |

A player's balances are just sums: **Available** = sum of their WALLET
entries, **Held in matches** = sum of their HELD entries. `getBalances` in
`ledger.ts` does exactly that. `MatchPlayer.heldCents` mirrors the HELD
balance for display; the ledger is the source of truth (settlement and
refunds read the ledger).

Example: Reece and Maya play a $20 1v1. Each has $20 held. Maya is down, presses
18 and loses the hole, so she has $40 held and pays double:

| Tx | EXTERNAL | HELD Reece | HELD Maya | WALLET Reece | WALLET Maya |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reece books | −20 | +20 | | | |
| Maya joins | −20 | | +20 | | |
| Maya presses | −20 | | +20 | | |
| Settle (Reece +40, Maya −40) | | −20 | −40 | +60 | 0 |

Every row sums to zero; Reece's wallet holds his $20 back plus $40 won.

## Safety rules the code keeps

- **Balanced or nothing.** `postTransaction` refuses entries that don't sum to
  zero, aren't whole cents, or are zero. Settlement refuses results that don't
  sum to zero or that a hold can't cover.
- **Holds cover the worst case.** The hold at booking/join is
  `maxLossCents(format, stake)`; a press adds `pressHoldCents(stake)` for each
  presser before the press is recorded.
- **One transaction per state change.** Every change is a conditional update
  (`where status = ...`) inside a database transaction, so double taps,
  retries and two people acting at once can't move money twice. A second join,
  press, confirm, leave, cancel or sweep is a no-op.
- **Charge, then write; refund on failure.** Card charges happen just before
  the database transaction. If the transaction fails (spot taken, match
  closed), the charge is refunded straight away.
- **Write, then refund.** Card refunds are sent only after the database has
  recorded them, so a retry can't refund twice. Each refund goes back to the
  charge that funded it (`LedgerEntry.paymentRef`).
- **Withdrawals** carry a request id from the page, so a repeated tap
  withdraws once, and can't exceed the wallet balance.

## Sweeping

`sweepMatches(now)` voids every OPEN match teeing off within 2 hours. It runs
lazily at the top of the `/matches` pages and the match APIs, and on demand with
`npm run sweep` (point a cron at it in production).

## For other code

- Booking: `checkout()` in `src/lib/booking.ts` takes the `match` set up at checkout.
- `src/lib/wagers/matches.ts`: `joinMatch`, `leaveMatch`, `sweepMatches`,
  `voidMatch`, `cancelMatchForReservation`, `markReadyIfFull`, `getMatch`,
  `listMyMatches`, `listOpenChallenges`, `openSlots`, `sideLabel`, `wagerHoldCents`.
- `src/lib/wagers/round.ts`: `callPress`, `onScoresChanged`, `confirmCard`,
  `disputeCard`, `resolveDispute`.
- `src/lib/wagers/ledger.ts`: `getBalances`, `listHistory`, `withdraw`,
  `postTransaction`, `assertBalanced`, `settlementLegs`, `ledgerTotal`.
- HTTP: `POST /api/matches/[code]/join` `{ side, acceptedTerms, pointVoteCents? }`,
  `POST /api/matches/[code]/leave`, `POST /api/matches/[code]` with
  `{ action: "press", opponentSide, holeNumber }`, `{ action: "confirm" }`,
  `{ action: "dispute", reason }` or `{ action: "resolve", resolution }` (admin),
  `GET/POST /api/wallet`.

## Later, with real money

Holding other people's money for wagers needs a licensed payments partner
(e.g. Stripe Connect with manual payouts) and state-by-state legal review; the
user's `state` is already on their profile for that. The ledger is designed so
the fake provider can be swapped without changing the money rules.
