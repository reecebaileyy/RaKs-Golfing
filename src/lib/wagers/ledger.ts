// Double-entry ledger for wager money. Every movement is one transaction (a txId) whose entries
// sum to exactly zero. Sign convention: a user's WALLET and HELD balances are positive when we
// owe them money; EXTERNAL goes negative as money comes in from cards and back up as it leaves.
//
//   wager hold     EXTERNAL -X, HELD(user) +X
//   refund         HELD(user) -X, EXTERNAL +X
//   settle         HELD(each) -held, WALLET(each) +(held + result)   (results sum to zero)
//   withdraw       WALLET(user) -X, EXTERNAL +X
//
// All money here goes through the fake payment provider; nothing real is charged.

import type { LedgerAccount, Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../api";
import { payments } from "../payments";

type Tx = Prisma.TransactionClient;

export type LedgerKind = "WAGER_HOLD" | "PRESS_HOLD" | "SETTLE" | "REFUND" | "WITHDRAW";

export interface Leg {
  account: LedgerAccount;
  userId?: string | null;
  amountCents: number;
}

export interface LedgerTx {
  kind: LedgerKind;
  legs: Leg[];
  matchId?: string | null;
  memo?: string;
  paymentRef?: string | null;
  /** Pass a fixed id to make the write idempotent: a second post with the same txId is a no-op. */
  txId?: string;
}

/** Throws unless every leg is a whole, non-zero number of cents and the legs sum to zero. */
export function assertBalanced(legs: Leg[]): void {
  if (legs.length < 2) throw new Error("A ledger transaction needs at least two entries.");
  let sum = 0;
  for (const leg of legs) {
    if (!Number.isInteger(leg.amountCents) || leg.amountCents === 0) {
      throw new Error(`Ledger amounts must be whole, non-zero cents (got ${leg.amountCents}).`);
    }
    if ((leg.account === "WALLET" || leg.account === "HELD") && !leg.userId) {
      throw new Error(`${leg.account} entries need a user.`);
    }
    sum += leg.amountCents;
  }
  if (sum !== 0) throw new Error(`Ledger transaction is off by ${sum} cents.`);
}

/** Drops zero legs and merges legs on the same account and user, so callers can build legs naively. */
export function compactLegs(legs: Leg[]): Leg[] {
  const merged = new Map<string, Leg>();
  for (const leg of legs) {
    const key = `${leg.account}:${leg.userId ?? ""}`;
    const prev = merged.get(key);
    if (prev) prev.amountCents += leg.amountCents;
    else merged.set(key, { ...leg });
  }
  return [...merged.values()].filter((l) => l.amountCents !== 0);
}

export function newTxId(): string {
  return `tx_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Writes one balanced transaction. Returns its txId. */
export async function postTransaction(tx: Tx, input: LedgerTx): Promise<string> {
  assertBalanced(input.legs);
  const txId = input.txId ?? newTxId();
  if (input.txId && (await tx.ledgerEntry.findFirst({ where: { txId }, select: { id: true } }))) return txId;
  await tx.ledgerEntry.createMany({
    data: input.legs.map((leg) => ({
      txId,
      kind: input.kind,
      account: leg.account,
      userId: leg.userId ?? null,
      matchId: input.matchId ?? null,
      amountCents: leg.amountCents,
      memo: input.memo ?? "",
      paymentRef: input.paymentRef ?? null,
    })),
  });
  return txId;
}

/**
 * Settlement legs: each player's whole hold leaves HELD, and they get back held + result in WALLET.
 * Results (signed, + won) must sum to zero and nobody can lose more than they have held.
 */
export function settlementLegs(players: { userId: string; heldCents: number; resultCents: number }[]): Leg[] {
  const total = players.reduce((s, p) => s + p.resultCents, 0);
  if (total !== 0) throw new Error(`Settlement results sum to ${total}, not zero.`);
  const legs: Leg[] = [];
  for (const p of players) {
    const payout = p.heldCents + p.resultCents;
    if (payout < 0) throw new Error(`Hold for ${p.userId} (${p.heldCents}) doesn't cover a loss of ${-p.resultCents}.`);
    legs.push({ account: "HELD", userId: p.userId, amountCents: -p.heldCents });
    legs.push({ account: "WALLET", userId: p.userId, amountCents: payout });
  }
  return compactLegs(legs);
}

// ---------- Balances ----------

export interface Balances {
  /** Withdrawable winnings and refunds left in the app. */
  walletCents: number;
  /** Money held in matches that haven't settled. */
  heldCents: number;
}

export async function getBalances(userId: string, client: Tx = db): Promise<Balances> {
  const rows = await client.ledgerEntry.groupBy({
    by: ["account"],
    where: { userId, account: { in: ["WALLET", "HELD"] } },
    _sum: { amountCents: true },
  });
  const sum = (a: LedgerAccount) => rows.find((r) => r.account === a)?._sum.amountCents ?? 0;
  return { walletCents: sum("WALLET"), heldCents: sum("HELD") };
}

/** What is held for one player in one match, straight from the ledger. */
export async function heldInMatch(client: Tx, matchId: string, userId: string): Promise<number> {
  const agg = await client.ledgerEntry.aggregate({
    where: { matchId, userId, account: "HELD" },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

export interface HistoryItem {
  txId: string;
  kind: string;
  createdAt: Date;
  memo: string;
  matchCode: string | null;
  /** Change to the user's wallet. */
  walletCents: number;
  /** Change to the user's held money. */
  heldCents: number;
}

/** The user's own entries, one line per transaction, newest first. */
export async function listHistory(userId: string, take = 50): Promise<HistoryItem[]> {
  const entries = await db.ledgerEntry.findMany({
    where: { userId },
    include: { match: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: take * 4,
  });
  const byTx = new Map<string, HistoryItem>();
  for (const e of entries) {
    let item = byTx.get(e.txId);
    if (!item) {
      item = { txId: e.txId, kind: e.kind, createdAt: e.createdAt, memo: e.memo, matchCode: e.match?.code ?? null, walletCents: 0, heldCents: 0 };
      byTx.set(e.txId, item);
    }
    if (e.account === "WALLET") item.walletCents += e.amountCents;
    if (e.account === "HELD") item.heldCents += e.amountCents;
  }
  return [...byTx.values()].slice(0, take);
}

// ---------- Card charges and refunds (fake provider) ----------

/** Charges a card for money to hold. Throws a 402 the user can read when it fails. */
export async function chargeCard(input: { amountCents: number; description: string; email?: string | null }): Promise<string> {
  const charge = await payments.charge({ amountCents: input.amountCents, description: input.description, customerEmail: input.email ?? undefined });
  if (!charge.ok) throw new AppError(charge.error, 402, "PAYMENT_FAILED");
  return charge.ref;
}

export interface CardRefund {
  ref: string;
  amountCents: number;
}

/** Sends refunds back to cards. Called after the database commit so a retry can never refund twice. */
export async function sendRefunds(refunds: CardRefund[]): Promise<void> {
  for (const r of refunds) {
    if (r.amountCents > 0 && r.ref !== "none") await payments.refund(r.ref, r.amountCents);
  }
}

/**
 * Refunds everything held for one player in a match back to the cards it came from.
 * Writes the REFUND transaction and zeroes MatchPlayer.heldCents; returns the card refunds to send after commit.
 */
export async function refundHeld(tx: Tx, matchId: string, userId: string, memo: string): Promise<CardRefund[]> {
  const held = await heldInMatch(tx, matchId, userId);
  await tx.matchPlayer.updateMany({ where: { matchId, userId }, data: { heldCents: 0 } });
  if (held === 0) return [];
  if (held < 0) throw new Error(`Negative hold for ${userId} in ${matchId}.`);

  // Pay back each card charge that funded the hold, newest first, until the held amount is covered.
  const charges = await tx.ledgerEntry.findMany({
    where: { matchId, userId, account: "HELD", amountCents: { gt: 0 }, kind: { in: ["WAGER_HOLD", "PRESS_HOLD"] } },
    orderBy: { createdAt: "desc" },
  });
  const refunds: CardRefund[] = [];
  let left = held;
  for (const c of charges) {
    if (left === 0) break;
    const amountCents = Math.min(left, c.amountCents);
    if (c.paymentRef) refunds.push({ ref: c.paymentRef, amountCents });
    left -= amountCents;
  }
  await postTransaction(tx, {
    kind: "REFUND",
    matchId,
    memo,
    legs: [
      { account: "HELD", userId, amountCents: -held },
      { account: "EXTERNAL", amountCents: held },
    ],
  });
  return refunds;
}

/** Fake "Withdraw to bank": moves the whole requested amount out of the wallet. */
export async function withdraw(input: { userId: string; amountCents: number; requestId?: string }): Promise<Balances> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new AppError("Enter an amount to withdraw.");
  // A retried request (double tap, flaky network) carries the same requestId and is a no-op.
  const txId = input.requestId ? `wd_${input.userId}_${input.requestId}` : newTxId();
  await db.$transaction(async (tx) => {
    if (await tx.ledgerEntry.findFirst({ where: { txId }, select: { id: true } })) return;
    // Take the write lock first so two withdrawals can't both pass the balance check.
    await tx.user.update({ where: { id: input.userId }, data: {} });
    const { walletCents } = await getBalances(input.userId, tx);
    if (input.amountCents > walletCents) throw new AppError("That's more than your wallet balance.", 409, "INSUFFICIENT");
    await postTransaction(tx, {
      txId,
      kind: "WITHDRAW",
      memo: "Withdraw to bank (demo)",
      paymentRef: `fake_payout_${crypto.randomUUID().slice(0, 12)}`,
      legs: [
        { account: "WALLET", userId: input.userId, amountCents: -input.amountCents },
        { account: "EXTERNAL", amountCents: input.amountCents },
      ],
    });
  });
  return getBalances(input.userId);
}

/** Sum of every entry for a match (or the whole ledger). Always zero when the books are right. */
export async function ledgerTotal(where: Prisma.LedgerEntryWhereInput = {}, client: Tx = db): Promise<number> {
  const agg = await client.ledgerEntry.aggregate({ where, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}
