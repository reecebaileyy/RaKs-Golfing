# Booking flow (modeled on GolfNow)

This milestone copies the shape of a GolfNow booking. Sources: a capture of
golfnow.com's own traffic with [REA](https://github.com/morluto/rea) (browsing
as a guest, nothing submitted), GolfNow's public
[booking FAQ](https://memberships.golfnow.com/faqs/), and its
[Tee Time Protection terms](https://www.golfnow.com/cancellation-protection/terms-and-conditions).
GolfNow's back office (how money is settled with courses and how holds reach a
course's tee sheet) isn't visible from outside, so those parts below are our
own design.

## What GolfNow does, and what we do

| Step | GolfNow | RaKs Golfing |
| --- | --- | --- |
| Search | Date, golfers, holes, time of day, price, Hot Deals filter. Results grouped by course with tee time chips. | Same filters on `/`, `GET /api/tee-times`. |
| Tee time | Rates per time (e.g. 18 w/ cart, 9 walking, Hot Deal), each with its own golfer limits (`playerRule`). | `/tee-times/[id]`. `TeeTime.minPlayers`/`spotsLeft`, and `Rate.minPlayers`/`maxPlayers`. |
| Hold | Picking a time and golfer count holds it for **5 minutes**. If it sold elsewhere, it offers the closest open time. | `POST /api/holds` takes spots off the sheet atomically for 5 minutes. A 409 returns up to 3 nearby times. Expired holds put spots back. |
| Price | Green fees per golfer, a per-golfer **convenience fee** that can differ by rate, sales tax unless "Tax Included". | `src/lib/pricing.ts`. Fee per course, overridable per rate (`Rate.convenienceFeeCents`). |
| Payment | **Hot Deals are prepaid in full.** Other times are usually pay at course, with only the fee charged online (some courses take partial or full prepayment). | `Rate.paymentMode`: `PREPAID` charges everything online. `PAY_AT_COURSE` charges only our fees online and shows "Due at course". |
| Protection | Tee Time Protection on prepaid times lets you cancel up to 1 hour before. | Optional add-on at checkout, $3/golfer, prepaid rates only. |
| Confirm | "Thank you" page with reservation details. | `/reservations/[code]` with an 8-character confirmation code. |
| Cancel | Refundable 24h+ before (course policy can differ). Convenience fee kept unless the course closes. Inside the window, no refund. | `src/lib/cancellation.ts`. Window per course (`cancelWindowHours`). |
| Guests | Guest checkout allowed. Rewards only when signed in. | Guest checkout by email. `Golfer` records now carry `handicap` for the competition milestone. |

## GolfNow's calls, as captured

Captured from the browser on 2026-10-17 (Fullerton Golf Course, facility 928):

1. `POST /api/tee-times/courses-near-me`: date, lat/long, radius, players
   (0 = any), holes, `timeMin`/`timeMax` in half-hour slots, `hotDealsOnly`.
2. `POST /api/tee-times/tee-time-search-results` (paged, by `facilityId`). Each
   time has `teeTimeRates[]` with `teeTimeRateId`, `rateName`, `isHotDeal`,
   `playerRule`, and per-golfer `greensFees`, `transactionFeesTotal` (the
   booking fee), a total, and a "regular" reference price. The date strip uses
   `GET /api/tee-times/tee-times/facility/{id}/summaries/from/{d}/to/{d}`.
3. `GET /api/tee-times/facility/{fid}/tee-time/{id}/select-rate/players/0`:
   every rate for one slot (Hot Deal, Online Rate, member rate), each its own
   `teeTimeRateId`.
4. Tee time page `/tee-times/facility/{fid}/tee-time/{teeTimeRateId}`: price
   per golfer count (green fee, booking fee, taxes, due online, due at course,
   total). Golfer counts a rate doesn't allow are greyed out.
5. "Continue to Book" opens `/checkout/players/{n}`, which requires signing in
   (guest checkout still asks for an email first). Past this point the capture
   stopped. From the site's code: `GET /api/reservation/checkoutmodel/{cacheKey}`,
   then `POST /api/reservation/invoice-details` recomputes the total with promo
   codes, Tee Time Protection, gift cards and points.

What this changed here: the booking fee and golfer limits are per rate
(Hot Deals had a $3.49 fee vs $2.99 and were often 1-2 golfers only), and the
Continue button shows the full total including fees and tax, as GolfNow's tee
time page does. The hold length isn't visible in traffic, so the 5 minutes
comes from GolfNow's FAQ.

## Adapters

- **Tee sheet** (`src/lib/teesheet.ts`): `syncAvailability`, `reserveSpots`,
  `releaseSpots`, `confirmBooking`, `cancelBooking`. `local` is the only
  provider today: our tables are the tee sheet. A partner tee sheet
  (Lightspeed/Chronogolf, foreUP, Club Prophet, ...) plugs in by setting
  `Course.teeSheet` and registering a provider.
- **Payments** (`src/lib/payments.ts`): a fake provider so the flow runs end
  to end. No card data is collected yet. Stripe Connect fits the money flow:
  the golfer pays once, the course's share goes to the course's connected
  account and the booking fee stays with us.
