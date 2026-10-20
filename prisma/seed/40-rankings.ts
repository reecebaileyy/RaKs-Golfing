// Settled match history among the demo golfers over the last two months, so the leaderboard
// and rankings show real numbers. Each match is played out hole by hole from the golfers'
// skill, scored like the real formats, and settled with results that sum to zero.
// No ledger entries or hole scores: this is history only ("seeded history").
import type { MatchFormat, PrismaClient, ScoringBasis } from "@prisma/client";
import { addDays, todayIn, zonedTime } from "../../src/lib/time";

const TZ = "America/Los_Angeles";

// Strokes over par a golfer typically shoots; mirrors DEMO_USERS in prisma/seed.ts.
const SKILL: Record<string, number> = {
  "reece@example.com": 9,
  "maya@example.com": 12,
  "jordan@example.com": 16,
  "sam@example.com": 4,
  "alex@example.com": 20,
};

let state = 2026;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

// [daysAgo, format, scoring, players by email prefix]. Alex plays twice so he shows as "Not ranked yet".
const HISTORY: [number, MatchFormat, ScoringBasis, string[]][] = [
  [58, "SINGLES_STROKE", "NET", ["reece", "maya"]],
  [55, "SINGLES_MATCH", "GROSS", ["sam", "jordan"]],
  [52, "FOURBALL_MATCH", "NET", ["reece", "jordan", "maya", "sam"]],
  [49, "NINE_POINT", "NET", ["maya", "jordan", "sam"]],
  [46, "SINGLES_MATCH", "NET", ["reece", "sam"]],
  [43, "THREESOME_STROKE", "NET", ["reece", "maya", "alex"]],
  [40, "SINGLES_STROKE", "GROSS", ["maya", "jordan"]],
  [37, "FOURBALL_STROKE", "NET", ["sam", "jordan", "reece", "maya"]],
  [34, "SINGLES_MATCH", "NET", ["jordan", "reece"]],
  [31, "THREESOME_MATCH", "NET", ["sam", "maya", "jordan"]],
  [27, "SINGLES_STROKE", "NET", ["sam", "maya"]],
  [24, "NINE_POINT", "GROSS", ["reece", "sam", "jordan"]],
  [21, "SINGLES_MATCH", "NET", ["maya", "reece"]],
  [18, "FOURBALL_MATCH", "GROSS", ["reece", "sam", "maya", "jordan"]],
  [15, "SINGLES_STROKE", "NET", ["jordan", "alex"]],
  [12, "THREESOME_STROKE", "NET", ["reece", "jordan", "sam"]],
  [9, "SINGLES_MATCH", "NET", ["sam", "reece"]],
  [6, "SINGLES_STROKE", "NET", ["maya", "jordan"]],
  [3, "NINE_POINT", "NET", ["maya", "reece", "sam"]],
];

const THREE_PLAYER: MatchFormat[] = ["NINE_POINT", "THREESOME_STROKE", "THREESOME_MATCH"];

interface Golfer {
  id: string;
  index: number;
  verified: boolean;
  strokes: number[]; // gross per hole
  courseHandicap: number;
  side: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const cmp = (a: number, b: number) => Math.sign(b - a); // +1 when a is lower (better)

/** Holes won minus holes lost for `a` over `b`, given per-hole scores. */
function holesUp(a: number[], b: number[]) {
  return sum(a.map((x, i) => cmp(x, b[i])));
}

export async function seed(db: PrismaClient) {
  const users = await db.user.findMany({ where: { email: { in: Object.keys(SKILL) } } });
  const byKey = new Map(users.map((u) => [u.email!.split("@")[0], u]));
  const courses = await db.course.findMany({ include: { teeSets: true, holes: { orderBy: { number: "asc" } } } });
  if (users.length < 5 || courses.length === 0) return;
  const today = todayIn(TZ);

  for (const [n, [daysAgo, format, scoring, keys]] of HISTORY.entries()) {
    const course = courses[n % courses.length];
    const tee = course.teeSets.find((t) => t.name === (n % 3 === 0 ? "Blue" : "White")) ?? course.teeSets[0];
    const startsAt = zonedTime(addDays(today, -daysAgo), 7 + (n % 6), (n % 6) * 10, TZ);
    const stakeCents = pick([2000, 2000, 2500, 5000]);
    const pointValueCents = format === "NINE_POINT" ? pick([100, 300]) : null;

    const golfers: Golfer[] = keys.map((key, i) => {
      const u = byKey.get(key)!;
      const index = u.handicapIndex ?? 18;
      const courseHandicap = Math.round(index * (tee.slope / 113) + (tee.courseRating - tee.par));
      const skill = SKILL[u.email!];
      const strokes = course.holes.map((h) => {
        // Harder holes cost more; a bit of luck either way.
        const extra = skill / 18 + (9.5 - h.strokeIndex) / 36 + (rand() - 0.5) * 2.6;
        return Math.max(h.par - 1, h.par + Math.round(extra));
      });
      const side = THREE_PLAYER.includes(format) ? i : format.startsWith("FOURBALL") ? Math.floor(i / 2) : i;
      return { id: u.id, index, verified: u.verified, strokes, side, courseHandicap };
    });

    // Play off the low man in match play; full handicaps in stroke play (as in the real rules).
    const low = Math.min(...golfers.map((g) => g.courseHandicap));
    const isMatchPlay = format.endsWith("_MATCH") || format === "NINE_POINT";
    const scored = golfers.map((g) => {
      const ch = g.courseHandicap - (isMatchPlay ? low : 0);
      const rec = course.holes.map((h) => Math.floor(ch / 18) + (h.strokeIndex <= ch % 18 ? 1 : 0));
      const net = g.strokes.map((s, i) => s - (scoring === "NET" ? rec[i] : 0));
      return { ...g, received: scoring === "NET" ? rec : Array(18).fill(0), net, ch };
    });

    const result = new Map(scored.map((g) => [g.id, 0]));
    const settle = (winner: string, loser: string, cents: number) => {
      result.set(winner, result.get(winner)! + cents);
      result.set(loser, result.get(loser)! - cents);
    };

    if (format === "NINE_POINT") {
      // 5-3-1 per hole, ties split the points; each pair settles the point gap, capped at the stake.
      const points = scored.map(() => 0);
      for (let h = 0; h < 18; h++) {
        const order = scored.map((g, i) => ({ i, s: g.net[h] })).sort((a, b) => a.s - b.s);
        const awards = [5, 3, 1];
        for (let k = 0; k < 3; ) {
          let j = k;
          while (j + 1 < 3 && order[j + 1].s === order[k].s) j++;
          const share = sum(awards.slice(k, j + 1)) / (j - k + 1);
          for (let t = k; t <= j; t++) points[order[t].i] += share;
          k = j + 1;
        }
      }
      for (let a = 0; a < 3; a++)
        for (let b = a + 1; b < 3; b++) {
          const cents = Math.min(stakeCents, Math.round(Math.abs(points[a] - points[b]) * pointValueCents!));
          if (points[a] > points[b]) settle(scored[a].id, scored[b].id, cents);
          else if (points[b] > points[a]) settle(scored[b].id, scored[a].id, cents);
        }
    } else if (THREE_PLAYER.includes(format)) {
      for (let a = 0; a < 3; a++)
        for (let b = a + 1; b < 3; b++) {
          const [A, B] = [scored[a], scored[b]];
          const edge = format === "THREESOME_MATCH" ? holesUp(A.net, B.net) : sum(B.net) - sum(A.net);
          if (edge > 0) settle(A.id, B.id, stakeCents);
          else if (edge < 0) settle(B.id, A.id, stakeCents);
        }
    } else {
      // Two sides: best ball per hole for fourball, the golfer's own card in singles.
      const team = (side: number) => {
        const members = scored.filter((g) => g.side === side);
        return course.holes.map((_, h) => Math.min(...members.map((g) => g.net[h])));
      };
      const [s0, s1] = [team(0), team(1)];
      const edge = format.endsWith("_MATCH") ? holesUp(s0, s1) : sum(s1) - sum(s0);
      // Each player wins or loses the stake against their pairing.
      for (const g of scored) {
        const won = (g.side === 0 ? edge : -edge) > 0;
        if (edge !== 0) result.set(g.id, won ? stakeCents : -stakeCents);
      }
    }

    const creator = scored[0].id;
    const at = (minutes: number) => new Date(startsAt.getTime() + minutes * 60_000);
    const teeTime = await db.teeTime.create({ data: { courseId: course.id, startsAt, spotsLeft: 4 - scored.length } });
    const match = await db.match.create({
      data: {
        code: `HIST${String(n + 1).padStart(4, "0")}`,
        format,
        scoring,
        stakeCents,
        pointValueCents,
        status: "SETTLED",
        createdById: creator,
        courseId: course.id,
        teeTimeId: teeTime.id,
        teeSetId: tee.id,
        createdAt: at(-3 * 24 * 60),
        readyAt: at(-60),
        startedAt: at(0),
        finishedAt: at(270),
        settledAt: at(300),
        players: {
          create: scored.map((g) => ({
            userId: g.id,
            side: g.side,
            joinedAt: at(-2 * 24 * 60),
            acceptedTermsAt: at(-2 * 24 * 60),
            handicapIndex: g.index,
            verifiedAtStart: g.verified,
            courseHandicap: g.courseHandicap,
            playingHandicap: g.ch,
            strokesReceived: JSON.stringify(g.received),
            confirmedAt: at(285),
            resultCents: result.get(g.id)!,
          })),
        },
      },
    });

    // The round goes on each golfer's record too, like a finished match would.
    for (const g of scored) {
      const gross = sum(g.strokes);
      const adjusted = sum(course.holes.map((h, i) => Math.min(g.strokes[i], h.par + 5)));
      const differential = Math.round((113 / tee.slope) * (adjusted - tee.courseRating) * 10) / 10;
      await db.scoreCard.create({
        data: {
          userId: g.id,
          courseId: course.id,
          teeSetId: tee.id,
          playedAt: startsAt,
          holeStrokes: JSON.stringify(g.strokes),
          grossScore: gross,
          adjustedGross: adjusted,
          differential,
          source: "MATCH",
          matchId: match.id,
        },
      });
    }
  }
}
