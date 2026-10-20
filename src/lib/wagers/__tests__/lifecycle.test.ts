// Match lifecycle against a real Postgres database (its own schema, see pgTestDb.ts), with the golf math mocked so these tests
// only check the money: holds, refunds, settlement and idempotency.
// The real golf math is covered end to end by e2e/matches.spec.ts and the seed (prisma/seed/20-matches.ts).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const schema = await vi.hoisted(async () => {
  const { useTestSchema } = await import("../../__tests__/pgTestDb");
  return useTestSchema("wagers");
});

const golf = vi.hoisted(() => ({
  maxLossCents: (format: string, stake: number) => (format.startsWith("THREESOME") ? 2 * stake : stake),
  pressHoldCents: (stake: number) => stake,
  matchStrokes: (_f: string, _s: string, players: { id: string; handicapIndex: number }[]) =>
    Object.fromEntries(players.map((p) => [p.id, { courseHandicap: Math.round(p.handicapIndex), playingHandicap: Math.round(p.handicapIndex), strokes: Array(18).fill(0) }])),
  resolvePointVote: (votes: (number | null | undefined)[]) => (votes.every((v) => v) ? Math.min(...(votes as number[])) : null),
  computeMatchState: vi.fn(),
  pressEligibility: vi.fn(),
  settleMatch: vi.fn(),
}));
vi.mock("../../golf", () => golf);
vi.mock("../../weather", () => ({ snapshotForecast: vi.fn(async () => {}) }));
vi.mock("../../profile", () => ({
  canPlayMatches: vi.fn(async () => ({ ok: true })),
  addMatchScoreCards: vi.fn(async () => {}),
}));

import { db } from "../../db";
import { payments } from "../../payments";
import { cancelReservation, checkout, createHold } from "../../booking";
import { recordHoleScores } from "../../live";
import { getBalances, ledgerTotal, withdraw } from "../ledger";
import { joinMatch, leaveMatch, sweepMatches, type MatchSetup } from "../matches";
import { callPress, confirmCard, disputeCard, onScoresChanged, resolveDispute } from "../round";

const DAY = 86_400_000;
let course: { id: string; teeSetId: string };
const users: Record<string, string> = {};

beforeAll(async () => {
  const c = await db.course.create({
    data: {
      slug: "test", name: "Test Links", city: "Brea", state: "CA", address: "1 Test Rd", latitude: 33.9, longitude: -117.9,
      holes: { create: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })) },
      teeSets: { create: { name: "White", courseRating: 70, slope: 120, par: 72 } },
    },
    include: { teeSets: true },
  });
  course = { id: c.id, teeSetId: c.teeSets[0].id };
  for (const name of ["reece", "maya", "jordan", "sam"]) {
    const u = await db.user.create({ data: { email: `${name}@example.com`, name, passwordHash: "x", handicapIndex: 10, verified: name === "maya" } });
    users[name] = u.id;
  }
});

afterAll(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});

beforeEach(() => {
  vi.restoreAllMocks();
  golf.computeMatchState.mockReset();
  golf.pressEligibility.mockReset();
  golf.settleMatch.mockReset();
});

async function teeTime(startsInMs = 2 * DAY) {
  return db.teeTime.create({
    data: {
      courseId: course.id,
      startsAt: new Date(Date.now() + startsInMs),
      rates: { create: { name: "18 Holes", holes: 18, greenFeeCents: 5000, paymentMode: "PAY_AT_COURSE" } },
    },
    include: { rates: true },
  });
}

const singles: Omit<MatchSetup, "teeSetId"> = { format: "SINGLES_MATCH", scoring: "NET", stakeCents: 2000, isOpenChallenge: true };

async function book(players: number, setup: Partial<MatchSetup> = {}, startsInMs?: number) {
  const t = await teeTime(startsInMs);
  const hold = await createHold({ rateId: t.rates[0].id, players });
  const reservation = await checkout({
    holdId: hold.id,
    userId: users.reece,
    golfer: { name: "Reece" },
    withProtection: false,
    acceptedPolicies: true,
    match: { ...singles, teeSetId: course.teeSetId, ...setup },
  });
  const match = await db.match.findUniqueOrThrow({ where: { reservationId: reservation.id } });
  return { reservation, match, teeTime: t, hold };
}

async function expectBooksBalance(matchId?: string) {
  expect(await ledgerTotal()).toBe(0);
  if (matchId) expect(await ledgerTotal({ matchId })).toBe(0);
}

describe("booking with a match", () => {
  it("charges booking + wager once and holds the wager", async () => {
    const charge = vi.spyOn(payments, "charge");
    const { reservation, match } = await book(2);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge.mock.calls[0][0].amountCents).toBe(2 * 299 + 2000);
    expect(reservation.dueOnlineCents).toBe(598);
    expect(match.status).toBe("OPEN");
    expect(match.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    const entries = await db.ledgerEntry.findMany({ where: { matchId: match.id } });
    expect(entries.map((e) => [e.kind, e.account, e.amountCents]).sort()).toEqual([
      ["WAGER_HOLD", "EXTERNAL", -2000],
      ["WAGER_HOLD", "HELD", 2000],
    ]);
    expect(new Set(entries.map((e) => e.txId)).size).toBe(1);
    const golfer = await db.golfer.findUniqueOrThrow({ where: { id: reservation.golferId } });
    expect(golfer.userId).toBe(users.reece);
    await expectBooksBalance(match.id);
  });

  it("a double submit books once", async () => {
    const t = await teeTime();
    const hold = await createHold({ rateId: t.rates[0].id, players: 2 });
    const input = { holdId: hold.id, userId: users.reece, golfer: { name: "Reece" }, withProtection: false, acceptedPolicies: true, match: { ...singles, teeSetId: course.teeSetId } };
    const refund = vi.spyOn(payments, "refund");
    const [a, b] = await Promise.all([checkout(input), checkout(input)]);
    expect(a.id).toBe(b.id);
    expect(await db.match.count({ where: { teeTimeId: t.id } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { kind: "WAGER_HOLD", match: { teeTimeId: t.id } } })).toBe(2);
    // If both requests charged, the loser's charge was refunded in full.
    for (const call of refund.mock.calls) expect(call[1]).toBe(598 + 2000);
    await expectBooksBalance();
  });

  it("rejects a player count that doesn't fit the format and a stake under $20", async () => {
    const t = await teeTime();
    const hold = await createHold({ rateId: t.rates[0].id, players: 3 });
    const base = { holdId: hold.id, userId: users.reece, golfer: { name: "Reece" }, withProtection: false, acceptedPolicies: true };
    await expect(checkout({ ...base, match: { ...singles, teeSetId: course.teeSetId } })).rejects.toThrow(/needs 2 golfers/);
    await expect(checkout({ ...base, match: { ...singles, format: "THREESOME_STROKE", stakeCents: 1900, teeSetId: course.teeSetId } })).rejects.toThrow(/minimum/);
  });
});

describe("joining", () => {
  it("fills the match, freezes strokes and goes READY; a second tap is a no-op", async () => {
    const { match } = await book(2);
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true });
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true });
    const after = await db.match.findUniqueOrThrow({ where: { id: match.id }, include: { players: true } });
    expect(after.status).toBe("READY");
    const maya = after.players.find((p) => p.userId === users.maya)!;
    expect(maya.handicapIndex).toBe(10);
    expect(maya.verifiedAtStart).toBe(true);
    expect(JSON.parse(maya.strokesReceived!)).toHaveLength(18);
    expect(await getBalances(users.maya)).toMatchObject({ heldCents: 2000 });
    expect(await db.ledgerEntry.count({ where: { matchId: match.id, userId: users.maya } })).toBe(1);
    await expectBooksBalance(match.id);
  });

  it("two golfers racing for the last spot: one gets it, the other is refunded", async () => {
    const { match } = await book(2);
    const refund = vi.spyOn(payments, "refund");
    const results = await Promise.allSettled([
      joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true }),
      joinMatch({ code: match.code, userId: users.jordan, side: 1, acceptedTerms: true }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(refund).toHaveBeenCalledTimes(1);
    expect(await db.matchPlayer.count({ where: { matchId: match.id } })).toBe(2);
    await expectBooksBalance(match.id);
  });

  it("fourball: the booker's partner slot is joinable and READY waits for all four", async () => {
    const { match } = await book(4, { format: "FOURBALL_MATCH" });
    await joinMatch({ code: match.code, userId: users.maya, side: 0, acceptedTerms: true });
    await expect(joinMatch({ code: match.code, userId: users.jordan, side: 0, acceptedTerms: true })).rejects.toThrow(/taken/);
    await joinMatch({ code: match.code, userId: users.jordan, side: 1, acceptedTerms: true });
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("OPEN");
    await joinMatch({ code: match.code, userId: users.sam, side: 1, acceptedTerms: true });
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("READY");
  });

  it("nine point: READY sets the voted point value", async () => {
    const { match } = await book(3, { format: "NINE_POINT", pointVoteCents: 500 });
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true, pointVoteCents: 300 });
    await joinMatch({ code: match.code, userId: users.jordan, side: 2, acceptedTerms: true, pointVoteCents: 500 });
    const after = await db.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(after.status).toBe("READY");
    expect(after.pointValueCents).toBe(300); // the mock picks the lowest
  });

  it("leaving before READY refunds in full; the booker can't leave", async () => {
    const { match } = await book(4, { format: "FOURBALL_STROKE" });
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true });
    const refund = vi.spyOn(payments, "refund");
    await leaveMatch({ code: match.code, userId: users.maya });
    await leaveMatch({ code: match.code, userId: users.maya });
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund.mock.calls[0][1]).toBe(2000);
    expect(await heldFor(match.id, users.maya)).toBe(0);
    await expect(leaveMatch({ code: match.code, userId: users.reece })).rejects.toThrow(/Cancel the booking/);
    await expectBooksBalance(match.id);
  });
});

async function heldFor(matchId: string, userId: string) {
  const agg = await db.ledgerEntry.aggregate({ where: { matchId, userId, account: "HELD" }, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}

describe("void and cancel", () => {
  it("sweep voids an open match inside 2 hours, refunds it and keeps the tee time", async () => {
    const { match, reservation, teeTime: t } = await book(2, {}, 3 * 3_600_000);
    expect(await sweepMatches(new Date())).toBe(0);
    const refund = vi.spyOn(payments, "refund");
    expect(await sweepMatches(new Date(t.startsAt.getTime() - 3_600_000))).toBeGreaterThanOrEqual(1);
    expect(await sweepMatches(new Date(t.startsAt.getTime() - 3_600_000))).toBe(0);
    const after = await db.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(after.status).toBe("VOID");
    expect(refund).toHaveBeenCalledWith(reservation.paymentRef, 2000);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("CONFIRMED");
    expect(await heldFor(match.id, users.reece)).toBe(0);
    await expectBooksBalance(match.id);
  });

  it("cancelling the booking calls off a READY match and refunds every hold", async () => {
    const { match, reservation } = await book(2);
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true });
    const refund = vi.spyOn(payments, "refund");
    await cancelReservation(reservation.confirmationCode);
    await cancelReservation(reservation.confirmationCode);
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("CANCELLED");
    expect(refund.mock.calls.map((c) => c[1]).sort()).toEqual([2000, 2000]);
    expect(await heldFor(match.id, users.reece)).toBe(0);
    expect(await heldFor(match.id, users.maya)).toBe(0);
    await expectBooksBalance(match.id);
  });
});

describe("the round", () => {
  async function readyMatch(format: MatchSetup["format"] = "SINGLES_MATCH") {
    const { match } = await book(2, { format });
    await joinMatch({ code: match.code, userId: users.maya, side: 1, acceptedTerms: true });
    return match;
  }
  async function score(matchId: string, hole: number) {
    for (const userId of [users.reece, users.maya]) {
      await db.holeScore.create({ data: { matchId, userId, holeNumber: hole, strokes: 4, enteredById: userId } });
    }
  }

  it("READY -> LIVE -> press -> CONFIRMING -> SETTLED, with money in the right wallets", async () => {
    const match = await readyMatch();
    golf.computeMatchState.mockReturnValue({ finished: false });
    await score(match.id, 1);
    await onScoresChanged(match.id);
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("LIVE");

    // Maya is down and presses 18. A second tap doesn't charge again.
    golf.pressEligibility.mockReturnValue({ eligible: true, holes: [18] });
    const charge = vi.spyOn(payments, "charge");
    await callPress({ matchId: match.id, userId: users.maya, opponentSide: 0, holeNumber: 18 });
    await callPress({ matchId: match.id, userId: users.maya, opponentSide: 0, holeNumber: 18 });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(await heldFor(match.id, users.maya)).toBe(4000);
    await expect(callPress({ matchId: match.id, userId: users.reece, opponentSide: 0, holeNumber: 18 })).rejects.toThrow(/other side/);

    golf.computeMatchState.mockReturnValue({ finished: true });
    await onScoresChanged(match.id);
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("CONFIRMING");

    // Maya lost the press: she pays double.
    golf.settleMatch.mockImplementation((input: { players: { id: string; side: number }[] }) => ({
      payouts: Object.fromEntries(input.players.map((p) => [p.id, p.side === 0 ? 4000 : -4000])),
      pressOutcomes: ["LOST"],
      lines: [],
    }));
    const reeceBefore = await getBalances(users.reece);
    const mayaBefore = await getBalances(users.maya);
    await confirmCard({ matchId: match.id, userId: users.reece });
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("CONFIRMING");
    await Promise.all([confirmCard({ matchId: match.id, userId: users.maya }), confirmCard({ matchId: match.id, userId: users.maya })]);

    const after = await db.match.findUniqueOrThrow({ where: { id: match.id }, include: { players: true, presses: true } });
    expect(after.status).toBe("SETTLED");
    expect(after.presses[0].outcome).toBe("LOST");
    expect(after.players.find((p) => p.userId === users.reece)!.resultCents).toBe(4000);
    expect(golf.settleMatch).toHaveBeenCalledTimes(1);
    expect(await db.ledgerEntry.count({ where: { matchId: match.id, kind: "SETTLE" } })).toBeGreaterThan(0);
    expect(new Set((await db.ledgerEntry.findMany({ where: { matchId: match.id, kind: "SETTLE" } })).map((e) => e.txId)).size).toBe(1);

    const reeceAfter = await getBalances(users.reece);
    const mayaAfter = await getBalances(users.maya);
    expect(reeceAfter.walletCents - reeceBefore.walletCents).toBe(6000); // own $20 back + $40 won
    expect(mayaAfter.walletCents - mayaBefore.walletCents).toBe(0);
    expect(mayaAfter.heldCents - mayaBefore.heldCents).toBe(-4000);
    await expectBooksBalance(match.id);
  });

  async function confirmingMatch() {
    const match = await readyMatch();
    golf.computeMatchState.mockReturnValue({ finished: true });
    await score(match.id, 1);
    await onScoresChanged(match.id);
    golf.settleMatch.mockImplementation((input: { players: { id: string; side: number }[] }) => ({
      payouts: Object.fromEntries(input.players.map((p) => [p.id, p.side === 0 ? 2000 : -2000])),
      pressOutcomes: [],
      lines: [],
    }));
    return match;
  }

  it("the last two players confirming at the same moment settle the match once", async () => {
    const match = await confirmingMatch();
    const results = await Promise.allSettled([
      confirmCard({ matchId: match.id, userId: users.reece }),
      confirmCard({ matchId: match.id, userId: users.maya }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("SETTLED");
    expect(golf.settleMatch).toHaveBeenCalledTimes(1);
    expect(new Set((await db.ledgerEntry.findMany({ where: { matchId: match.id, kind: "SETTLE" } })).map((e) => e.txId)).size).toBe(1);
    await expectBooksBalance(match.id);
  });

  it("a score fixed while the last player confirms either reopens the card or is refused", async () => {
    const match = await confirmingMatch();
    await confirmCard({ matchId: match.id, userId: users.reece });
    const [edit, confirm] = await Promise.allSettled([
      recordHoleScores({ matchId: match.id, enteredById: users.reece, holeNumber: 1, scores: [{ userId: users.maya, strokes: 5 }] }),
      confirmCard({ matchId: match.id, userId: users.maya }),
    ]);
    expect(confirm.status).toBe("fulfilled");
    const after = await db.match.findUniqueOrThrow({ where: { id: match.id }, include: { players: true } });
    const { strokes } = await db.holeScore.findFirstOrThrow({ where: { matchId: match.id, userId: users.maya, holeNumber: 1 } });
    if (after.status === "SETTLED") {
      // The confirm got there first: the card it paid out on can't change afterwards (and no deadlock).
      expect(edit).toMatchObject({ status: "rejected", reason: expect.objectContaining({ code: "CLOSED" }) });
      expect(strokes).toBe(4);
    } else {
      // The fix got there first: Reece has to confirm the new card before anything settles.
      expect(edit.status).toBe("fulfilled");
      expect(after.status).toBe("CONFIRMING");
      expect(strokes).toBe(5);
      expect(after.players.find((p) => p.userId === users.reece)!.confirmedAt).toBeNull();
    }
    await expectBooksBalance(match.id);
  });

  it("confirming is only for a finished card, and a score change resets confirmations", async () => {
    const match = await readyMatch();
    golf.computeMatchState.mockReturnValue({ finished: false });
    await score(match.id, 1);
    await onScoresChanged(match.id);
    await expect(confirmCard({ matchId: match.id, userId: users.reece })).rejects.toThrow(/18 holes/);
    golf.computeMatchState.mockReturnValue({ finished: true });
    await onScoresChanged(match.id);
    await confirmCard({ matchId: match.id, userId: users.reece });
    await onScoresChanged(match.id);
    expect((await db.matchPlayer.findFirstOrThrow({ where: { matchId: match.id, userId: users.reece } })).confirmedAt).toBeNull();
  });

  it("a dispute holds the money; admin refund gives every cent back, press included", async () => {
    const match = await readyMatch();
    golf.computeMatchState.mockReturnValue({ finished: false });
    await score(match.id, 1);
    await onScoresChanged(match.id);
    golf.pressEligibility.mockReturnValue({ eligible: true, holes: [18] });
    await callPress({ matchId: match.id, userId: users.maya, opponentSide: 0, holeNumber: 18 });
    await disputeCard({ matchId: match.id, userId: users.reece, reason: "Hole 3 was a 5" });
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("DISPUTED");
    expect(await heldFor(match.id, users.maya)).toBe(4000);

    const refund = vi.spyOn(payments, "refund");
    await resolveDispute(match.id, "refund");
    await expect(resolveDispute(match.id, "refund")).rejects.toThrow(/isn't in dispute/);
    expect(refund.mock.calls.map((c) => c[1]).sort()).toEqual([2000, 2000, 2000]);
    expect(await heldFor(match.id, users.maya)).toBe(0);
    expect(await heldFor(match.id, users.reece)).toBe(0);
    await expectBooksBalance(match.id);
  });

  it("two players disputing at the same moment are both recorded", async () => {
    const match = await readyMatch();
    golf.computeMatchState.mockReturnValue({ finished: false });
    await score(match.id, 1);
    await onScoresChanged(match.id);
    const results = await Promise.allSettled([
      disputeCard({ matchId: match.id, userId: users.reece, reason: "Hole 1 was a 5" }),
      disputeCard({ matchId: match.id, userId: users.maya, reason: "Hole 1 was a 3" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe("DISPUTED");
    const players = await db.matchPlayer.findMany({ where: { matchId: match.id } });
    expect(players.map((p) => p.disputeReason).sort()).toEqual(["Hole 1 was a 3", "Hole 1 was a 5"]);
  });
});

describe("wallet", () => {
  it("withdraws once per request id and never more than the balance", async () => {
    const userId = (await db.user.create({ data: { email: "w@example.com", name: "W", passwordHash: "x" } })).id;
    await db.ledgerEntry.createMany({
      data: [
        { txId: "seed_w", kind: "SETTLE", account: "EXTERNAL", amountCents: -5000 },
        { txId: "seed_w", kind: "SETTLE", account: "WALLET", userId, amountCents: 5000 },
      ],
    });
    await expect(withdraw({ userId, amountCents: 6000 })).rejects.toThrow(/more than/);
    await withdraw({ userId, amountCents: 3000, requestId: "req-12345" });
    await withdraw({ userId, amountCents: 3000, requestId: "req-12345" });
    expect((await getBalances(userId)).walletCents).toBe(2000);
    const both = await Promise.allSettled([withdraw({ userId, amountCents: 2000 }), withdraw({ userId, amountCents: 2000 })]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getBalances(userId)).walletCents).toBe(0);
    await expectBooksBalance();
  });

  it("a retry racing the first withdrawal is a no-op, not an error", async () => {
    const userId = (await db.user.create({ data: { email: "w2@example.com", name: "W2", passwordHash: "x" } })).id;
    await db.ledgerEntry.createMany({
      data: [
        { txId: "seed_w2", kind: "SETTLE", account: "EXTERNAL", amountCents: -5000 },
        { txId: "seed_w2", kind: "SETTLE", account: "WALLET", userId, amountCents: 5000 },
      ],
    });
    const both = await Promise.allSettled([
      withdraw({ userId, amountCents: 3000, requestId: "req-race-1" }),
      withdraw({ userId, amountCents: 3000, requestId: "req-race-1" }),
    ]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await getBalances(userId)).walletCents).toBe(2000);
    await expectBooksBalance();
  });
});
