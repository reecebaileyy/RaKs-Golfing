// Demo matches, one in each interesting state, with ledger entries that balance:
// - an open challenge tomorrow (Sam, anyone can join)
// - a READY 1v1 today: Reece vs Maya, net, $20, singles match play
// - a LIVE fourball, holes 1-9 scored: Reece + Jordan vs Maya + Sam
// - a SETTLED singles stroke play from last week: Reece beat Jordan
// - a VOID open challenge from yesterday that nobody joined (Alex, refunded)
import type { MatchFormat, PrismaClient, ScoringBasis, TeeTime } from "@prisma/client";
import { matchStrokes, maxLossCents, settleMatch } from "../../src/lib/golf";
import { matchInclude, toScoringInput } from "../../src/lib/matchData";
import { postTransaction, settlementLegs } from "../../src/lib/wagers/ledger";
import { addDays, todayIn, zonedTime } from "../../src/lib/time";

const TZ = "America/Los_Angeles";
const HOUR = 3_600_000;

/** The golf math may still be a stub when this runs in a feature branch; fall back so the seed still works. */
function orFallback<T>(fn: () => T, fallback: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof Error && err.message === "not implemented") return fallback();
    throw err;
  }
}

const fallbackMaxLoss = (format: MatchFormat, stake: number) => (format.startsWith("THREESOME") ? 2 * stake : stake);

export async function seed(db: PrismaClient) {
  const users = Object.fromEntries((await db.user.findMany()).map((u) => [u.email!.split("@")[0], u]));
  const courses = await db.course.findMany({ include: { teeSets: true, holes: { orderBy: { number: "asc" } } }, orderBy: { name: "asc" } });
  const now = new Date();
  const today = todayIn(TZ, now);
  let refs = 0;
  const fakeRef = () => `fake_seed_${String(++refs).padStart(4, "0")}`;

  /** A tee time at `course` for `players`: an existing open one in [from, to), or a new one at `at`. */
  async function teeTimeFor(courseId: string, players: number, at: Date, window?: [Date, Date]): Promise<TeeTime & { rateId: string }> {
    if (window) {
      const found = await db.teeTime.findFirst({
        where: { courseId, spotsLeft: { gte: players }, minPlayers: { lte: players }, startsAt: { gte: window[0], lt: window[1] }, rates: { some: { holes: 18, maxPlayers: { gte: players } } } },
        include: { rates: { where: { holes: 18, maxPlayers: { gte: players } } } },
        orderBy: { startsAt: "asc" },
      });
      if (found) return { ...found, rateId: found.rates[0].id };
    }
    const created = await db.teeTime.create({
      data: { courseId, startsAt: at, spotsLeft: 4, rates: { create: { name: "18 Holes w/ Cart", holes: 18, greenFeeCents: 6500, paymentMode: "PAY_AT_COURSE" } } },
      include: { rates: true },
    });
    return { ...created, rateId: created.rates[0].id };
  }

  /** Books it the way checkout does: converted hold, reservation, one charge for the fee + wager. */
  async function book(userKey: string, teeTime: TeeTime & { rateId: string }, players: number) {
    const user = users[userKey];
    await db.teeTime.update({ where: { id: teeTime.id }, data: { spotsLeft: { decrement: players } } });
    const hold = await db.hold.create({
      data: { teeTimeId: teeTime.id, rateId: teeTime.rateId, players, status: "CONVERTED", expiresAt: new Date(now.getTime() + 5 * 60_000) },
    });
    const rate = await db.rate.findUniqueOrThrow({ where: { id: teeTime.rateId } });
    const golfer = await db.golfer.upsert({
      where: { email: user.email! },
      create: { email: user.email!, name: user.name, userId: user.id },
      update: { userId: user.id },
    });
    const fee = 299 * players;
    return db.reservation.create({
      data: {
        confirmationCode: `SEED${String(refs + 1).padStart(4, "0")}`,
        holdId: hold.id, teeTimeId: teeTime.id, rateId: rate.id, golferId: golfer.id, players,
        greenFeeTotalCents: rate.greenFeeCents * players, convenienceFeeCents: fee, taxCents: 0,
        dueOnlineCents: fee, dueAtCourseCents: rate.greenFeeCents * players, totalCents: fee + rate.greenFeeCents * players,
        paymentRef: fakeRef(),
      },
    });
  }

  async function createMatch(opts: {
    /** Fixed, from the match code alphabet, so demo links survive a reseed. */
    code: string;
    courseIndex: number;
    teeTime: TeeTime & { rateId: string };
    format: MatchFormat;
    scoring: ScoringBasis;
    stakeCents: number;
    open?: boolean;
    players: { key: string; side: number }[];
    status: "OPEN" | "READY" | "LIVE" | "SETTLED" | "VOID";
    joinedAt: Date;
  }) {
    const course = courses[opts.courseIndex];
    const tee = course.teeSets.find((t) => t.name === "White")!;
    const size = { SINGLES_STROKE: 2, SINGLES_MATCH: 2, FOURBALL_STROKE: 4, FOURBALL_MATCH: 4, NINE_POINT: 3, THREESOME_STROKE: 3, THREESOME_MATCH: 3 }[opts.format];
    const reservation = await book(opts.players[0].key, opts.teeTime, size);
    const held = orFallback(() => maxLossCents(opts.format, opts.stakeCents), () => fallbackMaxLoss(opts.format, opts.stakeCents));
    const match = await db.match.create({
      data: {
        code: opts.code, format: opts.format, scoring: opts.scoring, stakeCents: opts.stakeCents,
        isOpenChallenge: opts.open ?? false, createdById: users[opts.players[0].key].id,
        courseId: course.id, teeTimeId: opts.teeTime.id, teeSetId: tee.id, reservationId: reservation.id,
        createdAt: opts.joinedAt,
      },
    });
    for (const [i, p] of opts.players.entries()) {
      const user = users[p.key];
      await db.matchPlayer.create({
        data: { matchId: match.id, userId: user.id, side: p.side, joinedAt: new Date(opts.joinedAt.getTime() + i * 60_000), acceptedTermsAt: opts.joinedAt, heldCents: held },
      });
      await postTransaction(db, {
        kind: "WAGER_HOLD", matchId: match.id, memo: `Wager held for match ${match.code}`,
        paymentRef: i === 0 ? reservation.paymentRef : fakeRef(),
        legs: [{ account: "EXTERNAL", amountCents: -held }, { account: "HELD", userId: user.id, amountCents: held }],
      });
    }

    if (opts.status !== "OPEN" && opts.status !== "VOID") {
      // Freeze handicaps the way markReadyIfFull does.
      const holes = course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex }));
      const ids = opts.players.map((p) => ({ id: users[p.key].id, handicapIndex: users[p.key].handicapIndex ?? 0 }));
      const strokes = orFallback(
        () => matchStrokes(opts.format, opts.scoring, ids, tee, holes),
        () => Object.fromEntries(ids.map((p) => [p.id, { courseHandicap: Math.round(p.handicapIndex), playingHandicap: Math.round(p.handicapIndex), strokes: Array(18).fill(0) }])),
      );
      for (const p of opts.players) {
        const user = users[p.key];
        const s = strokes[user.id];
        await db.matchPlayer.update({
          where: { matchId_userId: { matchId: match.id, userId: user.id } },
          data: { handicapIndex: user.handicapIndex, verifiedAtStart: user.verified, courseHandicap: s.courseHandicap, playingHandicap: s.playingHandicap, strokesReceived: JSON.stringify(s.strokes) },
        });
      }
      await db.match.update({ where: { id: match.id }, data: { status: "READY", readyAt: opts.joinedAt } });
    }
    return { match, course, reservation, held };
  }

  /** Believable gross scores: par plus a few strokes, more for higher handicaps. */
  async function scoreHoles(matchId: string, keys: string[], upTo: number, enteredBy: string) {
    const course = (await db.match.findUniqueOrThrow({ where: { id: matchId }, include: { course: { include: { holes: { orderBy: { number: "asc" } } } } } })).course;
    for (const [k, key] of keys.entries()) {
      const index = users[key].handicapIndex ?? 18;
      for (const h of course.holes.slice(0, upTo)) {
        const extra = (h.number * 7 + k * 3) % 18 < Math.round(index) ? 1 : 0;
        const blowUp = (h.number + k) % 9 === 0 ? 1 : 0;
        const birdie = (h.number * 5 + k) % 17 === 0 ? -1 : 0;
        await db.holeScore.create({ data: { matchId, userId: users[key].id, holeNumber: h.number, strokes: h.par + extra + blowUp + birdie, enteredById: users[enteredBy].id } });
      }
    }
  }

  // 1. Open challenge tomorrow morning (Sam).
  const tomorrow = addDays(today, 1);
  const openTee = await teeTimeFor(courses[1].id, 2, zonedTime(tomorrow, 9, 0, TZ), [zonedTime(tomorrow, 8, 0, TZ), zonedTime(tomorrow, 12, 0, TZ)]);
  await createMatch({
    code: "CHAS25", courseIndex: courses.findIndex((c) => c.id === openTee.courseId), teeTime: openTee,
    format: "SINGLES_STROKE", scoring: "GROSS", stakeCents: 2500, open: true,
    players: [{ key: "sam", side: 0 }], status: "OPEN", joinedAt: new Date(now.getTime() - 3 * HOUR),
  });

  // 2. READY today: Reece vs Maya, later today if there's still a time, otherwise tomorrow afternoon.
  const endOfToday = zonedTime(addDays(today, 1), 0, 0, TZ);
  const later = new Date(now.getTime() + 3 * HOUR);
  const readyTee = await teeTimeFor(
    courses[0].id, 2,
    later < endOfToday ? later : zonedTime(tomorrow, 14, 0, TZ),
    later < endOfToday ? [later, endOfToday] : [zonedTime(tomorrow, 13, 0, TZ), zonedTime(tomorrow, 17, 0, TZ)],
  );
  await createMatch({
    code: "REMAYA", courseIndex: courses.findIndex((c) => c.id === readyTee.courseId), teeTime: readyTee,
    format: "SINGLES_MATCH", scoring: "NET", stakeCents: 2000,
    players: [{ key: "reece", side: 0 }, { key: "maya", side: 1 }], status: "READY", joinedAt: new Date(now.getTime() - 20 * HOUR),
  });

  // 3. LIVE fourball that teed off about 2.5 hours ago, through 9.
  const liveStart = new Date(Math.floor((now.getTime() - 2.5 * HOUR) / (10 * 60_000)) * 10 * 60_000);
  const liveTee = await teeTimeFor(courses[2].id, 4, liveStart);
  const live = await createMatch({
    code: "FRBAS9", courseIndex: 2, teeTime: liveTee, format: "FOURBALL_MATCH", scoring: "NET", stakeCents: 2000,
    players: [{ key: "reece", side: 0 }, { key: "jordan", side: 0 }, { key: "maya", side: 1 }, { key: "sam", side: 1 }],
    status: "LIVE", joinedAt: new Date(now.getTime() - 30 * HOUR),
  });
  await scoreHoles(live.match.id, ["reece", "jordan", "maya", "sam"], 9, "reece");
  await db.match.update({ where: { id: live.match.id }, data: { status: "LIVE", startedAt: liveStart } });

  // 4. SETTLED singles stroke play last week: Reece vs Jordan, net, $30.
  const lastWeek = zonedTime(addDays(today, -6), 8, 30, TZ);
  const settledTee = await teeTimeFor(courses[3].id, 2, lastWeek);
  const settled = await createMatch({
    code: "WKAGJ7", courseIndex: 3, teeTime: settledTee, format: "SINGLES_STROKE", scoring: "NET", stakeCents: 3000,
    players: [{ key: "reece", side: 0 }, { key: "jordan", side: 1 }], status: "SETTLED", joinedAt: new Date(lastWeek.getTime() - 48 * HOUR),
  });
  await scoreHoles(settled.match.id, ["reece", "jordan"], 18, "jordan");
  const finishedAt = new Date(lastWeek.getTime() + 4.5 * HOUR);
  const loaded = await db.match.findUniqueOrThrow({ where: { id: settled.match.id }, include: matchInclude });
  const input = toScoringInput(loaded);
  const payouts = orFallback(
    () => settleMatch(input).payouts,
    () => {
      // Lower net total wins the stake; a tie moves nothing.
      const total = (id: string) => input.gross[id].reduce<number>((s, g, i) => s + (g ?? 0) - input.strokes[id][i], 0);
      const [a, b] = input.players.map((p) => p.id);
      const diff = Math.sign(total(b) - total(a)) * input.stakeCents;
      return { [a]: diff, [b]: -diff };
    },
  );
  const rows = loaded.players.map((p) => ({ userId: p.userId, heldCents: settled.held, resultCents: payouts[p.userId] ?? 0 }));
  await postTransaction(db, { kind: "SETTLE", matchId: settled.match.id, memo: `Match ${settled.match.code} settled`, legs: settlementLegs(rows) });
  for (const r of rows) {
    await db.matchPlayer.update({
      where: { matchId_userId: { matchId: settled.match.id, userId: r.userId } },
      data: { resultCents: r.resultCents, heldCents: 0, confirmedAt: finishedAt },
    });
  }
  await db.match.update({
    where: { id: settled.match.id },
    data: { status: "SETTLED", startedAt: lastWeek, finishedAt, settledAt: new Date(finishedAt.getTime() + 15 * 60_000) },
  });
  try {
    const { addMatchScoreCards } = await import("../../src/lib/profile");
    await addMatchScoreCards(settled.match.id);
  } catch (err) {
    console.warn("Skipped match score cards:", err instanceof Error ? err.message : err);
  }

  // 5. VOID: Alex's open challenge yesterday that nobody joined. Wager refunded, tee time kept.
  const yesterday = zonedTime(addDays(today, -1), 15, 0, TZ);
  const voidTee = await teeTimeFor(courses[0].id, 2, yesterday);
  const voided = await createMatch({
    code: "VDAXK3", courseIndex: 0, teeTime: voidTee, format: "SINGLES_MATCH", scoring: "NET", stakeCents: 2000, open: true,
    players: [{ key: "alex", side: 0 }], status: "VOID", joinedAt: new Date(yesterday.getTime() - 30 * HOUR),
  });
  await postTransaction(db, {
    kind: "REFUND", matchId: voided.match.id, memo: `Match ${voided.match.code} void: no opponent in time, wager refunded`,
    legs: [{ account: "HELD", userId: users.alex.id, amountCents: -voided.held }, { account: "EXTERNAL", amountCents: voided.held }],
  });
  await db.matchPlayer.updateMany({ where: { matchId: voided.match.id }, data: { heldCents: 0 } });
  await db.match.update({ where: { id: voided.match.id }, data: { status: "VOID", voidedAt: new Date(yesterday.getTime() - 2 * HOUR) } });

  const total = await db.ledgerEntry.aggregate({ _sum: { amountCents: true } });
  if ((total._sum.amountCents ?? 0) !== 0) throw new Error(`Seeded ledger is off by ${total._sum.amountCents} cents.`);
}
