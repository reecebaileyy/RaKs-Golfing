import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { HOLD_MINUTES, MAX_PLAYERS, priceBooking, protectionAvailable } from "./pricing";
import { quoteCancellation } from "./cancellation";
import { payments } from "./payments";
import { teeSheetFor } from "./teesheet";
import { timeOfDay, zonedDayRange, type TimeOfDay } from "./time";
import { canPlayMatches } from "./profile";
import { snapshotForecast } from "./weather";
import { cancelMatchForReservation, createMatch, validateMatchSetup, wagerHoldCents, type MatchSetup } from "./wagers/matches";
import { sendRefunds } from "./wagers/ledger";

type Tx = Prisma.TransactionClient;

export class BookingError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAVAILABLE" | "EXPIRED" | "INVALID" | "PAYMENT_FAILED",
    public alternatives?: { teeTimeId: string; startsAt: Date; spotsLeft: number }[],
  ) {
    super(message);
  }
}

export function playerRange(rate: { minPlayers: number; maxPlayers: number }): string {
  return rate.minPlayers === rate.maxPlayers ? `${rate.minPlayers}` : `${rate.minPlayers}-${rate.maxPlayers}`;
}

/** Per-golfer booking fee: the rate's own if it sets one, otherwise the course's. */
export function bookingFeeCents(rate: { convenienceFeeCents: number | null }, course: { convenienceFeeCents: number }) {
  return rate.convenienceFeeCents ?? course.convenienceFeeCents;
}

// ---------- Search ----------

export interface SearchParams {
  date: string; // YYYY-MM-DD in the course's time zone
  players?: number;
  holes?: 9 | 18;
  hotDealsOnly?: boolean;
  timeOfDay?: TimeOfDay;
  maxPriceCents?: number;
  q?: string;
  now?: Date;
}

export async function searchTeeTimes(params: SearchParams) {
  const now = params.now ?? new Date();
  const courses = await db.course.findMany({
    where: params.q
      ? { OR: [{ name: { contains: params.q } }, { city: { contains: params.q } }] }
      : undefined,
    orderBy: { name: "asc" },
  });

  const results = [];
  for (const course of courses) {
    await teeSheetFor(course).syncAvailability(course.id, params.date);
    const { start, end } = zonedDayRange(params.date, course.timezone);
    const teeTimes = await db.teeTime.findMany({
      where: {
        courseId: course.id,
        startsAt: { gte: start > now ? start : now, lt: end },
        spotsLeft: { gte: params.players ?? 1 },
      },
      include: { rates: { orderBy: { greenFeeCents: "asc" } } },
      orderBy: { startsAt: "asc" },
    });

    const times = teeTimes
      .filter((t) => !params.timeOfDay || timeOfDay(t.startsAt, course.timezone) === params.timeOfDay)
      .map((t) => {
        const rates = t.rates.filter(
          (r) =>
            (!params.holes || r.holes === params.holes) &&
            (!params.players || (params.players >= r.minPlayers && params.players <= r.maxPlayers)) &&
            (!params.hotDealsOnly || r.isHotDeal) &&
            (!params.maxPriceCents || r.greenFeeCents <= params.maxPriceCents),
        );
        if (rates.length === 0) return null;
        const cheapest = rates[0];
        return {
          id: t.id,
          startsAt: t.startsAt,
          spotsLeft: t.spotsLeft,
          minPlayers: t.minPlayers,
          fromCents: cheapest.greenFeeCents,
          hasHotDeal: rates.some((r) => r.isHotDeal),
          holes: [...new Set(rates.map((r) => r.holes))].sort(),
          cartIncluded: rates.some((r) => r.cartIncluded),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    if (times.length > 0) results.push({ course, times });
  }
  return results;
}

export async function getTeeTime(id: string) {
  return db.teeTime.findUnique({
    where: { id },
    include: { course: true, rates: { orderBy: { greenFeeCents: "asc" } } },
  });
}

// ---------- Holds ----------

/** Give spots back from holds that ran out without checking out. */
async function releaseExpiredHolds(tx: Tx, teeTimeId: string, now: Date) {
  const teeTime = await tx.teeTime.findUniqueOrThrow({ where: { id: teeTimeId }, include: { course: true } });
  const sheet = teeSheetFor(teeTime.course);
  const expired = await tx.hold.findMany({
    where: { teeTimeId, status: "ACTIVE", expiresAt: { lte: now } },
  });
  for (const hold of expired) {
    const { count } = await tx.hold.updateMany({
      where: { id: hold.id, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
    if (count === 1) await sheet.releaseSpots(tx, teeTimeId, hold.players);
  }
}

/** Closest open times at the same course on the same day, as GolfNow offers when a time sells out. */
async function nearbyAlternatives(tx: Tx, teeTimeId: string, players: number, now: Date) {
  const original = await tx.teeTime.findUnique({ where: { id: teeTimeId }, include: { course: true } });
  if (!original) return [];
  const window = 3 * 3_600_000;
  const candidates = await tx.teeTime.findMany({
    where: {
      courseId: original.courseId,
      id: { not: teeTimeId },
      spotsLeft: { gte: players },
      startsAt: {
        gte: new Date(Math.max(now.getTime(), original.startsAt.getTime() - window)),
        lte: new Date(original.startsAt.getTime() + window),
      },
    },
    select: { id: true, startsAt: true, spotsLeft: true },
  });
  return candidates
    .sort(
      (a, b) =>
        Math.abs(a.startsAt.getTime() - original.startsAt.getTime()) -
        Math.abs(b.startsAt.getTime() - original.startsAt.getTime()),
    )
    .slice(0, 3)
    .map((c) => ({ teeTimeId: c.id, startsAt: c.startsAt, spotsLeft: c.spotsLeft }));
}

export async function createHold(input: { rateId: string; players: number; now?: Date }) {
  const now = input.now ?? new Date();
  if (!Number.isInteger(input.players) || input.players < 1 || input.players > MAX_PLAYERS) {
    throw new BookingError("Choose between 1 and 4 golfers.", "INVALID");
  }

  // Not wrapped in one transaction so the alternatives lookup still sees released holds.
  const rate = await db.rate.findUnique({
    where: { id: input.rateId },
    include: { teeTime: { include: { course: true } } },
  });
  if (!rate) throw new BookingError("That rate no longer exists.", "NOT_FOUND");
  if (rate.teeTime.startsAt <= now) throw new BookingError("That tee time has already gone off.", "UNAVAILABLE");
  if (input.players < rate.teeTime.minPlayers) {
    throw new BookingError(`This tee time needs at least ${rate.teeTime.minPlayers} golfers.`, "INVALID");
  }
  if (input.players < rate.minPlayers || input.players > rate.maxPlayers) {
    throw new BookingError(`${rate.name} is for ${playerRange(rate)} golfers.`, "INVALID");
  }

  return db.$transaction(async (tx) => {
    await releaseExpiredHolds(tx, rate.teeTimeId, now);

    const reserved = await teeSheetFor(rate.teeTime.course).reserveSpots(tx, rate.teeTimeId, input.players);
    if (!reserved) {
      const alternatives = await nearbyAlternatives(tx, rate.teeTimeId, input.players, now);
      throw new BookingError("That tee time just filled up.", "UNAVAILABLE", alternatives);
    }

    return tx.hold.create({
      data: {
        teeTimeId: rate.teeTimeId,
        rateId: rate.id,
        players: input.players,
        expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
      },
    });
  });
}

export async function getHold(id: string) {
  return db.hold.findUnique({
    where: { id },
    include: {
      rate: true,
      teeTime: { include: { course: { include: { teeSets: { orderBy: { name: "asc" } } } } } },
      reservation: true,
    },
  });
}

export async function releaseHold(id: string) {
  await db.$transaction(async (tx) => {
    const hold = await tx.hold.findUnique({ where: { id }, include: { teeTime: { include: { course: true } } } });
    if (!hold) return;
    const { count } = await tx.hold.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "RELEASED" } });
    if (count === 1) await teeSheetFor(hold.teeTime.course).releaseSpots(tx, hold.teeTimeId, hold.players);
  });
}

// ---------- Checkout ----------

export interface CheckoutInput {
  holdId: string;
  /** The signed-in booker. Every booking is a wagered match, so it needs an account. */
  userId: string;
  golfer: { name: string; phone?: string };
  withProtection: boolean;
  acceptedPolicies: boolean;
  /** The match set up in the checkout's Match step. */
  match: MatchSetup;
  now?: Date;
}

function confirmationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Books the tee time and opens its match in one go. One card charge covers what's due online for the
 * booking plus the booker's wager hold; if the database write fails afterwards the whole charge is refunded.
 */
export async function checkout(input: CheckoutInput) {
  const now = input.now ?? new Date();
  if (!input.acceptedPolicies) throw new BookingError("Please accept the course policies to book.", "INVALID");

  const hold = await getHold(input.holdId);
  if (!hold) throw new BookingError("We couldn't find that hold.", "NOT_FOUND");
  if (hold.status === "CONVERTED" && hold.reservation) return hold.reservation; // double submit
  if (hold.status !== "ACTIVE" || hold.expiresAt <= now) {
    throw new BookingError("Your 5 minute hold ran out. Pick the time again to keep going.", "EXPIRED");
  }

  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new BookingError("Sign in to book.", "INVALID");
  // The course confirmation and receipt go to an email, and the booking's golfer record is keyed by it.
  const email = user.email;
  if (!email) throw new BookingError("Add an email to your account to book.", "INVALID");
  const eligible = await canPlayMatches(user.id);
  if (!eligible.ok) throw new BookingError(eligible.reason ?? "Set up your handicap before booking a match.", "INVALID");

  const { rate, teeTime } = hold;
  const course = teeTime.course;
  validateMatchSetup(input.match, { players: hold.players, teeSetIds: course.teeSets.map((t) => t.id) });
  const wagerCents = wagerHoldCents(input.match.format, input.match.stakeCents);

  const price = priceBooking({
    players: hold.players,
    greenFeeCents: rate.greenFeeCents,
    paymentMode: rate.paymentMode,
    convenienceFeeCents: bookingFeeCents(rate, course),
    taxRateBps: course.taxRateBps,
    taxIncluded: course.taxIncluded,
    withProtection: input.withProtection && protectionAvailable(rate.paymentMode),
  });

  const chargedCents = price.dueOnlineCents + wagerCents;
  const charge = await payments.charge({
    amountCents: chargedCents,
    description: `${course.name} tee time for ${hold.players} + wager hold`,
    customerEmail: email,
  });
  if (!charge.ok) throw new BookingError(charge.error, "PAYMENT_FAILED");

  let reservation;
  try {
    reservation = await db.$transaction(async (tx) => {
      const { count } = await tx.hold.updateMany({
        where: { id: hold.id, status: "ACTIVE" },
        data: { status: "CONVERTED" },
      });
      if (count === 0) throw new BookingError("Your hold ran out before payment finished.", "EXPIRED");

      // The booking's golfer record is the account's, linked so tee times follow the account.
      const name = input.golfer.name.trim() || user.name;
      const golfer = await tx.golfer.upsert({
        where: { email },
        create: { email, name, phone: input.golfer.phone?.trim() || null, userId: user.id },
        update: { name, phone: input.golfer.phone?.trim() || undefined, userId: user.id },
      });

      const teeSheetRef = await teeSheetFor(course).confirmBooking(tx, {
        teeTimeId: teeTime.id,
        players: hold.players,
        golferName: golfer.name,
      });

      const created = await tx.reservation.create({
        data: {
          confirmationCode: confirmationCode(),
          teeSheetRef,
          holdId: hold.id,
          teeTimeId: teeTime.id,
          rateId: rate.id,
          golferId: golfer.id,
          players: hold.players,
          greenFeeTotalCents: price.greenFeeTotalCents,
          convenienceFeeCents: price.convenienceFeeCents,
          taxCents: price.taxCents,
          protectionCents: price.protectionCents,
          dueOnlineCents: price.dueOnlineCents,
          dueAtCourseCents: price.dueAtCourseCents,
          totalCents: price.totalCents,
          hasProtection: price.protectionCents > 0,
          paymentRef: charge.ref,
        },
      });
      const match = await createMatch(tx, {
        setup: input.match,
        createdById: user.id,
        courseId: course.id,
        teeTimeId: teeTime.id,
        reservationId: created.id,
        heldCents: wagerCents,
        paymentRef: charge.ref,
        now,
      });
      return { ...created, matchId: match.id, matchCode: match.code };
    });
  } catch (err) {
    await sendRefunds([{ ref: charge.ref, amountCents: chargedCents }]);
    // Two taps at once: the other request won, so hand back its booking.
    const again = await getHold(hold.id);
    if (again?.reservation) return again.reservation;
    throw err;
  }

  // The forecast is nice to have; a weather outage must never fail a paid booking.
  try {
    await snapshotForecast({ reservationId: reservation.id, matchId: reservation.matchId });
  } catch (err) {
    console.error("Weather snapshot failed", err);
  }
  return reservation;
}

// ---------- Reservations ----------

export async function getReservation(code: string) {
  return db.reservation.findUnique({
    where: { confirmationCode: code.toUpperCase() },
    include: {
      rate: true,
      golfer: true,
      teeTime: { include: { course: true } },
      match: { include: { players: true } },
    },
  });
}

/** A signed-in golfer's bookings, through the golfer record linked to their account. */
export async function listUserReservations(userId: string) {
  return db.reservation.findMany({
    where: { golfer: { userId } },
    include: { rate: true, teeTime: { include: { course: true } }, match: { select: { code: true, status: true } } },
    orderBy: { teeTime: { startsAt: "asc" } },
  });
}

export async function listReservations(email: string) {
  return db.reservation.findMany({
    where: { golfer: { email: email.trim().toLowerCase() } },
    include: { rate: true, teeTime: { include: { course: true } } },
    orderBy: { teeTime: { startsAt: "asc" } },
  });
}

export function cancellationQuote(
  r: NonNullable<Awaited<ReturnType<typeof getReservation>>>,
  now = new Date(),
) {
  return quoteCancellation({
    startsAt: r.teeTime.startsAt,
    now,
    cancelWindowHours: r.teeTime.course.cancelWindowHours,
    hasProtection: r.hasProtection,
    prepaidCourseCents: r.rate.paymentMode === "PREPAID" ? r.greenFeeTotalCents + r.taxCents : 0,
  });
}

export async function cancelReservation(code: string, now = new Date()) {
  const r = await getReservation(code);
  if (!r) throw new BookingError("We couldn't find that reservation.", "NOT_FOUND");
  if (r.status === "CANCELLED") return r;
  const quote = cancellationQuote(r, now);
  if (!quote.allowed) throw new BookingError(quote.reason, "INVALID");
  if (r.match && ["LIVE", "CONFIRMING", "DISPUTED"].includes(r.match.status)) {
    throw new BookingError("Your match has already started, so this booking can't be cancelled.", "INVALID");
  }

  // Database first, then the card refunds, so a retried cancel can never refund twice.
  const refunds = await db.$transaction(async (tx) => {
    const { count } = await tx.reservation.updateMany({
      where: { id: r.id, status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: now, refundCents: quote.refundCents },
    });
    if (count === 0) return [];
    await teeSheetFor(r.teeTime.course).cancelBooking(tx, {
      teeTimeId: r.teeTimeId,
      players: r.players,
      teeSheetRef: r.teeSheetRef,
    });
    // A match that hasn't started is called off and every player's wager comes back in full.
    const wagerRefunds = await cancelMatchForReservation(tx, r.id, now);
    const bookingRefund = quote.refundCents > 0 && r.paymentRef ? [{ ref: r.paymentRef, amountCents: quote.refundCents }] : [];
    return [...bookingRefund, ...wagerRefunds];
  });
  await sendRefunds(refunds);
  return getReservation(code);
}
