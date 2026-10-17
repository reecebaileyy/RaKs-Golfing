# Booking flow (modeled on GolfNow)

This milestone copies the shape of a GolfNow booking. Sources: GolfNow's public
[booking FAQ](https://memberships.golfnow.com/faqs/), its
[Tee Time Protection terms](https://www.golfnow.com/cancellation-protection/terms-and-conditions),
and its public tee time pages. GolfNow's back office (how money is settled with
courses and how holds reach a course's tee sheet) isn't visible from outside, so
those parts below are our own design.

## What GolfNow does, and what we do

| Step | GolfNow | RaKs Golfing |
| --- | --- | --- |
| Search | Date, golfers, holes, time of day, price, Hot Deals filter. Results grouped by course with tee time chips. | Same filters on `/`, `GET /api/tee-times`. |
| Tee time | Rates per time (e.g. 18 w/ cart, 9 walking, Hot Deal). Golfer count limited by the course (some times need 2+). URL `/tee-times/facility/{facilityId}/tee-time/{teeTimeId}`. | `/tee-times/[id]`. `TeeTime.minPlayers`, `spotsLeft`, many `Rate`s. |
| Hold | Picking a time and golfer count holds it for **5 minutes**. If it sold elsewhere, it offers the closest open time. | `POST /api/holds` takes spots off the sheet atomically for 5 minutes. A 409 returns up to 3 nearby times. Expired holds put spots back. |
| Price | Green fees per golfer, a per-golfer **convenience fee**, sales tax unless "Tax Included". | `src/lib/pricing.ts`. Fee is per course (`convenienceFeeCents`). |
| Payment | **Hot Deals are prepaid in full.** Other times are usually pay at course, with only the fee charged online (some courses take partial or full prepayment). | `Rate.paymentMode`: `PREPAID` charges everything online. `PAY_AT_COURSE` charges only our fees online and shows "Due at course". |
| Protection | Tee Time Protection on prepaid times lets you cancel up to 1 hour before. | Optional add-on at checkout, $3/golfer, prepaid rates only. |
| Confirm | "Thank you" page with reservation details. | `/reservations/[code]` with an 8-character confirmation code. |
| Cancel | Refundable 24h+ before (course policy can differ). Convenience fee kept unless the course closes. Inside the window, no refund. | `src/lib/cancellation.ts`. Window per course (`cancelWindowHours`). |
| Guests | Guest checkout allowed. Rewards only when signed in. | Guest checkout by email. `Golfer` records now carry `handicap` for the competition milestone. |

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
