// Money moments during and after a round. Owned by the wagers worker; signatures are the contract
// the game screen codes against. Each runs in one transaction and writes balanced ledger entries.

import type { MatchStatus, Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../api";
import { FORMAT_SIZE, loadMatch, matchInclude, toScoringInput, type LoadedMatch } from "../matchData";
import { computeMatchState, pressEligibility, pressHoldCents, settleMatch } from "../golf";
import { addMatchScoreCards } from "../profile";
import { chargeCard, heldInMatch, postTransaction, sendRefunds, settlementLegs, type CardRefund } from "./ledger";
import { closeAndRefund } from "./matches";

type Tx = Prisma.TransactionClient;

async function loadOrThrow(matchId: string): Promise<LoadedMatch> {
  const match = await loadMatch({ id: matchId });
  if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
  return match;
}

/** ALOHA PRESS: checks eligibility (golf/press.ts), holds the extra money from every player on the pressing side, records the Press. */
export async function callPress(input: { matchId: string; userId: string; opponentSide: number; holeNumber: number }): Promise<void> {
  const match = await loadOrThrow(input.matchId);
  const me = match.players.find((p) => p.userId === input.userId);
  if (!me) throw new AppError("Only players in this match can press.", 403, "FORBIDDEN");
  const side = me.side;
  const existing = match.presses.find((p) => p.side === side && p.opponentSide === input.opponentSide);
  if (existing) {
    if (existing.holeNumber === input.holeNumber) return; // double tap
    throw new AppError("Your side has already pressed in this match.", 409, "PRESSED");
  }
  if (match.status !== "LIVE") throw new AppError("You can only press while the match is being played.", 409, "NOT_LIVE");
  if (FORMAT_SIZE[match.format].sides === 2 && input.opponentSide !== 1 - side) {
    throw new AppError("Press against the other side.");
  }
  if (input.opponentSide === side || !match.players.some((p) => p.side === input.opponentSide)) {
    throw new AppError("Pick an opponent to press.");
  }

  const scoring = toScoringInput(match);
  const eligibility = pressEligibility(scoring, computeMatchState(scoring), side, input.opponentSide);
  if (!eligibility.eligible) throw new AppError(eligibility.reason ?? "You can't press right now.", 409, "NOT_ELIGIBLE");
  if (!eligibility.holes.includes(input.holeNumber)) {
    throw new AppError(`You can press on hole ${eligibility.holes.join(", ")}.`, 409, "NOT_ELIGIBLE");
  }

  // Everyone on the pressing side puts up the extra money, each through their own card.
  const extra = pressHoldCents(match.stakeCents);
  const pressers = match.players.filter((p) => p.side === side);
  const charges: (CardRefund & { userId: string })[] = [];
  try {
    for (const p of pressers) {
      const ref = await chargeCard({ amountCents: extra, description: `Press hold for match ${match.code}`, email: p.user.email });
      charges.push({ ref, amountCents: extra, userId: p.userId });
    }
    await db.$transaction(async (tx) => {
      const { count } = await tx.match.updateMany({ where: { id: match.id, status: "LIVE" }, data: { status: "LIVE" } });
      if (count === 0) throw new AppError("The match isn't live any more.", 409, "NOT_LIVE");
      // The unique (match, side, opponent) index stops a second press from a teammate tapping at the same time.
      await tx.press.create({
        data: { matchId: match.id, side, opponentSide: input.opponentSide, holeNumber: input.holeNumber, calledById: input.userId },
      });
      for (const c of charges) {
        await tx.matchPlayer.update({
          where: { matchId_userId: { matchId: match.id, userId: c.userId } },
          data: { heldCents: { increment: extra } },
        });
        await postTransaction(tx, {
          kind: "PRESS_HOLD",
          matchId: match.id,
          memo: `Press on hole ${input.holeNumber} in match ${match.code}`,
          paymentRef: c.ref,
          legs: [
            { account: "EXTERNAL", amountCents: -extra },
            { account: "HELD", userId: c.userId, amountCents: extra },
          ],
        });
      }
    });
  } catch (err) {
    await sendRefunds(charges);
    const isDuplicate = (err as { code?: string }).code === "P2002";
    if (isDuplicate) {
      const press = await db.press.findUnique({
        where: { matchId_side_opponentSide: { matchId: match.id, side, opponentSide: input.opponentSide } },
      });
      if (press?.holeNumber === input.holeNumber) return;
      throw new AppError("Your side has already pressed in this match.", 409, "PRESSED");
    }
    throw err;
  }
}

/** Called after each score write: moves READY -> LIVE on the first score and LIVE -> CONFIRMING once all 18 holes are in. */
export async function onScoresChanged(matchId: string): Promise<void> {
  const now = new Date();
  let match = await loadOrThrow(matchId);
  if (match.status === "READY" && match.scores.length > 0) {
    await db.match.updateMany({ where: { id: matchId, status: "READY" }, data: { status: "LIVE", startedAt: now } });
    match = await loadOrThrow(matchId);
  }
  if (match.status === "CONFIRMING") {
    // The card changed after people looked at it: everyone confirms the new one.
    await db.matchPlayer.updateMany({ where: { matchId, confirmedAt: { not: null } }, data: { confirmedAt: null } });
  }
  if (match.status === "LIVE" || match.status === "CONFIRMING") {
    const finished = computeMatchState(toScoringInput(match)).finished;
    if (finished && match.status === "LIVE") {
      await db.match.updateMany({ where: { id: matchId, status: "LIVE" }, data: { status: "CONFIRMING", finishedAt: now } });
    } else if (!finished && match.status === "CONFIRMING") {
      await db.match.updateMany({ where: { id: matchId, status: "CONFIRMING" }, data: { status: "LIVE", finishedAt: null } });
    }
  }
}

/**
 * Settles a finished match inside a transaction: moves it from one of `from` to SETTLED, pays every
 * player back what they get from their hold, and records results and press outcomes.
 * Returns false when another request already settled it.
 */
async function settleInTx(tx: Tx, matchId: string, from: MatchStatus[], now: Date): Promise<boolean> {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude });
  if (!from.includes(match.status)) return false;
  const input = toScoringInput(match);
  if (!computeMatchState(input).finished) throw new AppError("All 18 holes need scores before the match can settle.", 409, "UNFINISHED");
  const settlement = settleMatch(input);

  const { count } = await tx.match.updateMany({
    where: { id: matchId, status: { in: from } },
    data: { status: "SETTLED", settledAt: now, finishedAt: match.finishedAt ?? now },
  });
  if (count === 0) return false;

  const rows = [];
  for (const p of match.players) {
    rows.push({ userId: p.userId, heldCents: await heldInMatch(tx, matchId, p.userId), resultCents: settlement.payouts[p.userId] ?? 0 });
  }
  const legs = settlementLegs(rows);
  if (legs.length > 0) {
    await postTransaction(tx, { kind: "SETTLE", matchId, memo: `Match ${match.code} settled`, legs });
  }
  for (const r of rows) {
    await tx.matchPlayer.update({
      where: { matchId_userId: { matchId, userId: r.userId } },
      data: { resultCents: r.resultCents, heldCents: 0 },
    });
  }
  for (const [i, press] of match.presses.entries()) {
    const outcome = settlement.pressOutcomes[i];
    if (outcome) await tx.press.update({ where: { id: press.id }, data: { outcome } });
  }
  return true;
}

/** A player confirms the final card. When every player has confirmed, the match settles and money moves. */
export async function confirmCard(input: { matchId: string; userId: string }): Promise<void> {
  const now = new Date();
  const settled = await db.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: { players: true } });
    if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
    if (!match.players.some((p) => p.userId === input.userId)) throw new AppError("Only players in this match can confirm.", 403, "FORBIDDEN");
    if (match.status === "SETTLED") return false; // double tap after the last confirm
    if (match.status !== "CONFIRMING") throw new AppError("The card can be confirmed once all 18 holes are in.", 409, "NOT_CONFIRMING");
    await tx.matchPlayer.updateMany({
      where: { matchId: match.id, userId: input.userId, confirmedAt: null },
      data: { confirmedAt: now },
    });
    const waiting = await tx.matchPlayer.count({ where: { matchId: match.id, confirmedAt: null } });
    if (waiting > 0) return false;
    return settleInTx(tx, match.id, ["CONFIRMING"], now);
  });
  if (settled) await addMatchScoreCards(input.matchId);
}

/** A player disputes the card: the match goes to DISPUTED and money stays held for review. */
export async function disputeCard(input: { matchId: string; userId: string; reason: string }): Promise<void> {
  const reason = input.reason.trim().slice(0, 500);
  if (!reason) throw new AppError("Say what's wrong with the card.");
  await db.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: { players: true } });
    if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
    if (!match.players.some((p) => p.userId === input.userId)) throw new AppError("Only players in this match can dispute.", 403, "FORBIDDEN");
    if (match.status === "DISPUTED") {
      await tx.matchPlayer.updateMany({ where: { matchId: match.id, userId: input.userId, disputedAt: null }, data: { disputedAt: new Date(), disputeReason: reason } });
      return;
    }
    const { count } = await tx.match.updateMany({
      where: { id: match.id, status: { in: ["LIVE", "CONFIRMING"] } },
      data: { status: "DISPUTED" },
    });
    if (count === 0) throw new AppError("This match can't be disputed now.", 409, "NOT_DISPUTABLE");
    await tx.matchPlayer.update({
      where: { matchId_userId: { matchId: match.id, userId: input.userId } },
      data: { disputedAt: new Date(), disputeReason: reason },
    });
  });
}

/**
 * Admin review of a DISPUTED match. "settle" pays out on the card as it stands now (fix scores first);
 * "refund" voids the match and gives every player their whole hold back, presses included.
 */
export async function resolveDispute(matchId: string, action: "settle" | "refund"): Promise<void> {
  const now = new Date();
  if (action === "settle") {
    const settled = await db.$transaction((tx) => settleInTx(tx, matchId, ["DISPUTED"], now));
    if (!settled) throw new AppError("This match isn't in dispute.", 409, "NOT_DISPUTED");
    await addMatchScoreCards(matchId);
    return;
  }
  const refunds = await db.$transaction((tx) => closeAndRefund(tx, matchId, ["DISPUTED"], "VOID", now));
  if (!refunds) throw new AppError("This match isn't in dispute.", 409, "NOT_DISPUTED");
  await sendRefunds(refunds);
}
