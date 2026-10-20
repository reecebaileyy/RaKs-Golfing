// Matches from booking to tee off: set up at checkout, others join through an invite link or the
// open challenge board, and the match goes READY (handicap strokes frozen) once every slot is paid.
// Open matches that nobody filled are voided 2 hours before the tee time: wagers back, tee time kept.
//
// Every state change is a conditional update inside one transaction, so a double tap or a retry
// can never move money twice. Card charges happen before the transaction and are refunded if it fails.

import type { MatchFormat, MatchStatus, Prisma, ScoringBasis } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../api";
import { FORMAT_SIZE, MIN_STAKE_CENTS, matchInclude } from "../matchData";
import { matchStrokes, maxLossCents, resolvePointVote } from "../golf";
import { canPlayMatches } from "../profile";
import { chargeCard, postTransaction, refundHeld, sendRefunds, type CardRefund } from "./ledger";
import { MAX_STAKE_CENTS, POINT_VALUES, SWEEP_HOURS } from "./constants";

type Tx = Prisma.TransactionClient;

export { MAX_STAKE_CENTS, POINT_VALUES, SWEEP_HOURS };
const HOUR = 3_600_000;

// No 0/O or 1/I/L, so a code read out on the first tee can't be misheard.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface MatchSetup {
  format: MatchFormat;
  scoring: ScoringBasis;
  stakeCents: number;
  teeSetId: string;
  isOpenChallenge: boolean;
  /** NINE_POINT only: the booker's vote. */
  pointVoteCents?: number | null;
}

/** Players each side holds: 2 for fourball, otherwise 1. */
export function sideCapacity(format: MatchFormat): number {
  const { players, sides } = FORMAT_SIZE[format];
  return players / sides;
}

/** Sides that still have a free slot, one entry per free slot. */
export function openSlots(format: MatchFormat, players: { side: number }[]): number[] {
  const cap = sideCapacity(format);
  const slots: number[] = [];
  for (let side = 0; side < FORMAT_SIZE[format].sides; side++) {
    const taken = players.filter((p) => p.side === side).length;
    for (let i = taken; i < cap; i++) slots.push(side);
  }
  return slots;
}

export function sideLabel(format: MatchFormat, side: number): string {
  if (FORMAT_SIZE[format].sides === 3) return `Player ${side + 1}`;
  return side === 0 ? "Team A" : "Team B";
}

/** Throws an AppError the golfer can read when the match set up at checkout isn't playable. */
export function validateMatchSetup(setup: MatchSetup, ctx: { players: number; teeSetIds: string[] }): void {
  const size = FORMAT_SIZE[setup.format];
  if (!size) throw new AppError("Pick a match format.");
  if (ctx.players !== size.players) {
    throw new AppError(`This format needs ${size.players} golfers on the tee time. You're holding ${ctx.players}.`, 400, "PLAYERS");
  }
  if (!Number.isInteger(setup.stakeCents) || setup.stakeCents < MIN_STAKE_CENTS) {
    throw new AppError(`The minimum wager is $${MIN_STAKE_CENTS / 100}.`);
  }
  if (setup.stakeCents % 100 !== 0) throw new AppError("Wagers are in whole dollars.");
  if (setup.stakeCents > MAX_STAKE_CENTS) throw new AppError(`The most you can wager is $${MAX_STAKE_CENTS / 100}.`);
  if (!ctx.teeSetIds.includes(setup.teeSetId)) throw new AppError("Pick a set of tees at this course.");
  if (setup.format === "NINE_POINT") {
    if (!POINT_VALUES.includes(setup.pointVoteCents as (typeof POINT_VALUES)[number])) {
      throw new AppError("Vote for $1, $3 or $5 a point.");
    }
  }
}

/** What is held from each player at booking or when they join. */
export function wagerHoldCents(format: MatchFormat, stakeCents: number): number {
  return maxLossCents(format, stakeCents);
}

async function generateMatchCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    if (!(await tx.match.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Couldn't find a free match code.");
}

/**
 * Creates the match for a booking with the booker on side 0, already paid. Runs inside checkout's
 * transaction; the card charge (paymentRef) has already happened.
 */
export async function createMatch(
  tx: Tx,
  input: {
    setup: MatchSetup;
    createdById: string;
    courseId: string;
    teeTimeId: string;
    reservationId: string | null;
    heldCents: number;
    paymentRef: string;
    now: Date;
  },
) {
  const { setup } = input;
  const match = await tx.match.create({
    data: {
      code: await generateMatchCode(tx),
      format: setup.format,
      scoring: setup.scoring,
      stakeCents: setup.stakeCents,
      isOpenChallenge: setup.isOpenChallenge,
      createdById: input.createdById,
      courseId: input.courseId,
      teeTimeId: input.teeTimeId,
      teeSetId: setup.teeSetId,
      reservationId: input.reservationId,
      players: {
        create: {
          userId: input.createdById,
          side: 0,
          acceptedTermsAt: input.now,
          pointVoteCents: setup.format === "NINE_POINT" ? setup.pointVoteCents : null,
          heldCents: input.heldCents,
        },
      },
    },
  });
  await postTransaction(tx, {
    kind: "WAGER_HOLD",
    matchId: match.id,
    memo: `Wager held for match ${match.code}`,
    paymentRef: input.paymentRef,
    legs: [
      { account: "EXTERNAL", amountCents: -input.heldCents },
      { account: "HELD", userId: input.createdById, amountCents: input.heldCents },
    ],
  });
  return match;
}

/**
 * When every slot is filled and accepted: freeze each player's handicap and strokes, settle the
 * nine point vote and move OPEN -> READY. Returns whether the match went READY.
 */
export async function markReadyIfFull(tx: Tx, matchId: string, now: Date): Promise<boolean> {
  const match = await tx.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { players: { include: { user: true } }, teeSet: true, course: { include: { holes: { orderBy: { number: "asc" } } } } },
  });
  if (match.status !== "OPEN") return false;
  if (match.players.length < FORMAT_SIZE[match.format].players || match.players.some((p) => !p.acceptedTermsAt)) return false;

  const holes = match.course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex }));
  const strokes = matchStrokes(
    match.format,
    match.scoring,
    match.players.map((p) => ({ id: p.userId, handicapIndex: p.user.handicapIndex ?? 0 })),
    { courseRating: match.teeSet.courseRating, slope: match.teeSet.slope, par: match.teeSet.par },
    holes,
  );
  const pointValueCents = match.format === "NINE_POINT" ? resolvePointVote(match.players.map((p) => p.pointVoteCents)) : null;
  if (match.format === "NINE_POINT" && pointValueCents === null) return false;

  const { count } = await tx.match.updateMany({
    where: { id: matchId, status: "OPEN" },
    data: { status: "READY", readyAt: now, pointValueCents },
  });
  if (count === 0) return false;
  for (const p of match.players) {
    const s = strokes[p.userId];
    await tx.matchPlayer.update({
      where: { id: p.id },
      data: {
        handicapIndex: p.user.handicapIndex,
        verifiedAtStart: p.user.verified,
        courseHandicap: s?.courseHandicap ?? null,
        playingHandicap: s?.playingHandicap ?? null,
        strokesReceived: JSON.stringify(s?.strokes ?? Array(18).fill(0)),
      },
    });
  }
  return true;
}

// ---------- Joining and leaving ----------

export interface JoinInput {
  code: string;
  userId: string;
  side: number;
  acceptedTerms: boolean;
  pointVoteCents?: number | null;
  now?: Date;
}

class AlreadyJoined extends Error {}

export async function joinMatch(input: JoinInput) {
  const now = input.now ?? new Date();
  await sweepMatches(now);
  const match = await db.match.findUnique({ where: { code: input.code.toUpperCase() }, include: { players: true, teeTime: true } });
  if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
  if (match.players.some((p) => p.userId === input.userId)) return match; // double tap
  if (match.status !== "OPEN") throw new AppError("This match isn't taking players any more.", 409, "CLOSED");
  if (match.teeTime.startsAt.getTime() - now.getTime() <= SWEEP_HOURS * HOUR) {
    throw new AppError("It's too close to the tee time to join.", 409, "CLOSED");
  }
  if (!input.acceptedTerms) throw new AppError("Accept the match terms to join.");
  if (!openSlots(match.format, match.players).includes(input.side)) {
    throw new AppError("That spot was just taken. Pick another.", 409, "TAKEN");
  }
  if (match.format === "NINE_POINT" && !POINT_VALUES.includes(input.pointVoteCents as (typeof POINT_VALUES)[number])) {
    throw new AppError("Vote for $1, $3 or $5 a point.");
  }
  const eligible = await canPlayMatches(input.userId);
  if (!eligible.ok) throw new AppError(eligible.reason ?? "Set up your handicap before playing a match.", 403, "PROFILE");

  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  const heldCents = wagerHoldCents(match.format, match.stakeCents);
  const ref = await chargeCard({ amountCents: heldCents, description: `Wager hold for match ${match.code}`, email: user.email });

  try {
    await db.$transaction(async (tx) => {
      // Write first so concurrent joins queue up behind this one, then re-check under the lock.
      const { count } = await tx.match.updateMany({ where: { id: match.id, status: "OPEN" }, data: { status: "OPEN" } });
      if (count === 0) throw new AppError("This match isn't taking players any more.", 409, "CLOSED");
      const players = await tx.matchPlayer.findMany({ where: { matchId: match.id } });
      if (players.some((p) => p.userId === input.userId)) throw new AlreadyJoined();
      if (!openSlots(match.format, players).includes(input.side)) {
        throw new AppError("That spot was just taken. Pick another.", 409, "TAKEN");
      }
      await tx.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: input.userId,
          side: input.side,
          acceptedTermsAt: now,
          pointVoteCents: match.format === "NINE_POINT" ? input.pointVoteCents : null,
          heldCents,
        },
      });
      await postTransaction(tx, {
        kind: "WAGER_HOLD",
        matchId: match.id,
        memo: `Wager held for match ${match.code}`,
        paymentRef: ref,
        legs: [
          { account: "EXTERNAL", amountCents: -heldCents },
          { account: "HELD", userId: input.userId, amountCents: heldCents },
        ],
      });
      await markReadyIfFull(tx, match.id, now);
    });
  } catch (err) {
    await sendRefunds([{ ref, amountCents: heldCents }]);
    if (!(err instanceof AlreadyJoined)) throw err;
  }
  return db.match.findUniqueOrThrow({ where: { id: match.id }, include: { players: true, teeTime: true } });
}

/** Leaving before the match is READY gives the whole hold back. The booker cancels the booking instead. */
export async function leaveMatch(input: { code: string; userId: string }) {
  const match = await db.match.findUnique({ where: { code: input.code.toUpperCase() } });
  if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
  if (match.createdById === input.userId) {
    throw new AppError("You booked this tee time. Cancel the booking to call off the match.", 409, "CREATOR");
  }
  const refunds = await db.$transaction(async (tx) => {
    const { count } = await tx.match.updateMany({ where: { id: match.id, status: "OPEN" }, data: { status: "OPEN" } });
    if (count === 0) throw new AppError("Everyone's in, so the match is locked. Talk to your group.", 409, "LOCKED");
    const player = await tx.matchPlayer.findUnique({ where: { matchId_userId: { matchId: match.id, userId: input.userId } } });
    if (!player) return []; // already left
    const out = await refundHeld(tx, match.id, input.userId, `Left match ${match.code}: wager refunded`);
    await tx.matchPlayer.delete({ where: { id: player.id } });
    return out;
  });
  await sendRefunds(refunds);
}

// ---------- Void, cancel, sweep ----------

async function refundEveryone(tx: Tx, matchId: string, memo: string): Promise<CardRefund[]> {
  const players = await tx.matchPlayer.findMany({ where: { matchId } });
  const refunds: CardRefund[] = [];
  for (const p of players) refunds.push(...(await refundHeld(tx, matchId, p.userId, memo)));
  return refunds;
}

/** Moves a match from one of `from` to VOID or CANCELLED and refunds every hold. Returns card refunds to send. */
export async function closeAndRefund(
  tx: Tx,
  matchId: string,
  from: MatchStatus[],
  to: "VOID" | "CANCELLED",
  now: Date,
): Promise<CardRefund[] | null> {
  const { count } = await tx.match.updateMany({
    where: { id: matchId, status: { in: from } },
    data: { status: to, voidedAt: now },
  });
  if (count === 0) return null;
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
  const memo = to === "VOID" ? `Match ${match.code} void: no opponent in time, wager refunded` : `Match ${match.code} cancelled: wager refunded`;
  return refundEveryone(tx, matchId, memo);
}

/** Open match nobody filled: VOID, every hold refunded, the tee time stays booked. */
export async function voidMatch(matchId: string, now = new Date()): Promise<boolean> {
  const refunds = await db.$transaction((tx) => closeAndRefund(tx, matchId, ["OPEN"], "VOID", now));
  if (refunds) await sendRefunds(refunds);
  return refunds !== null;
}

/** Voids every OPEN match teeing off within 2 hours. Safe to run from any page or a cron. */
export async function sweepMatches(now = new Date()): Promise<number> {
  const due = await db.match.findMany({
    where: { status: "OPEN", teeTime: { startsAt: { lte: new Date(now.getTime() + SWEEP_HOURS * HOUR) } } },
    select: { id: true },
  });
  let voided = 0;
  for (const m of due) if (await voidMatch(m.id, now)) voided++;
  return voided;
}

/** Booking cancelled: a match that hasn't started is CANCELLED with every hold refunded in full. */
export async function cancelMatchForReservation(tx: Tx, reservationId: string, now: Date): Promise<CardRefund[]> {
  const match = await tx.match.findUnique({ where: { reservationId } });
  if (!match) return [];
  return (await closeAndRefund(tx, match.id, ["OPEN", "READY"], "CANCELLED", now)) ?? [];
}

// ---------- Reading ----------

export async function getMatch(code: string) {
  return db.match.findUnique({
    where: { code: code.toUpperCase() },
    include: { ...matchInclude, reservation: { select: { confirmationCode: true } } },
  });
}

export type MatchPhase = "upcoming" | "live" | "finished";

export function matchPhase(status: MatchStatus): MatchPhase {
  if (status === "OPEN" || status === "READY") return "upcoming";
  if (status === "LIVE" || status === "CONFIRMING" || status === "DISPUTED") return "live";
  return "finished";
}

const listInclude = {
  course: true,
  teeTime: true,
  teeSet: true,
  players: { include: { user: { select: { id: true, name: true, handicapIndex: true, verified: true } } } },
} satisfies Prisma.MatchInclude;

export async function listMyMatches(userId: string) {
  return db.match.findMany({
    where: { players: { some: { userId } } },
    include: listInclude,
    orderBy: { teeTime: { startsAt: "asc" } },
  });
}

/** Other golfers' open challenges with a free slot that tee off far enough out to join. */
export async function listOpenChallenges(userId: string | null, now = new Date()) {
  const matches = await db.match.findMany({
    where: {
      status: "OPEN",
      isOpenChallenge: true,
      teeTime: { startsAt: { gt: new Date(now.getTime() + SWEEP_HOURS * HOUR) } },
      ...(userId ? { players: { none: { userId } } } : {}),
    },
    include: listInclude,
    orderBy: { teeTime: { startsAt: "asc" } },
  });
  return matches.filter((m) => openSlots(m.format, m.players).length > 0);
}
