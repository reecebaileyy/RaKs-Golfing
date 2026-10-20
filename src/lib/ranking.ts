// Rankings and leaderboard. Owned by the rankings worker; signatures are the contract.
// Computed on the fly from settled matches and score cards: one query per table, then pure math
// in rankingMath.ts. VOID and CANCELLED matches never count.
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { rankGolfers, type RankingMatch } from "./rankingMath";
import { todayIn, zonedTime } from "./time";

export interface RankingParts {
  winLoss: number; // 0-100
  opponentStrength: number; // 0-100
  scoring: number; // 0-100
  profit: number; // 0-100
}

export interface UserRanking {
  userId: string;
  rank: number | null; // null until the golfer has enough matches
  score: number | null; // 0-100
  parts: RankingParts | null;
  wins: number;
  losses: number;
  ties: number;
  scoringAverage: number | null;
  earningsCents: number;
}

export const LEADERBOARD_SORTS = ["ranking", "scoring", "matches", "earnings"] as const;
export type LeaderboardSort = (typeof LEADERBOARD_SORTS)[number];
export const LEADERBOARD_PERIODS = ["all", "year", "30d"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export interface LeaderboardRow extends UserRanking {
  user: { id: string; name: string; verified: boolean };
  matchesPlayed: number;
}

export interface LeaderboardOptions {
  sort?: LeaderboardSort;
  courseId?: string;
  period?: LeaderboardPeriod;
}

// Calendar years follow the demo courses' time zone.
const TZ = "America/Los_Angeles";

/** Earliest play date a period includes, or null for all time. */
export function periodStart(period: LeaderboardPeriod, now = new Date()): Date | null {
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === "year") return zonedTime(`${todayIn(TZ, now).slice(0, 4)}-01-01`, 0, 0, TZ);
  return null;
}

async function computeRows({ courseId, period = "all" }: LeaderboardOptions): Promise<LeaderboardRow[]> {
  const since = periodStart(period);
  const matchWhere: Prisma.MatchWhereInput = {
    status: "SETTLED",
    ...(courseId ? { courseId } : {}),
    ...(since ? { teeTime: { startsAt: { gte: since } } } : {}),
  };
  const cardWhere: Prisma.ScoreCardWhereInput = {
    ...(courseId ? { courseId } : {}),
    ...(since ? { playedAt: { gte: since } } : {}),
  };
  const [users, matches, cards] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, verified: true } }),
    db.match.findMany({
      where: matchWhere,
      select: {
        id: true,
        format: true,
        settledAt: true,
        createdAt: true,
        teeTime: { select: { startsAt: true } },
        players: { select: { userId: true, side: true, handicapIndex: true, verifiedAtStart: true, resultCents: true } },
      },
    }),
    db.scoreCard.findMany({ where: cardWhere, select: { userId: true, playedAt: true, differential: true, grossScore: true } }),
  ]);

  const rankingMatches: RankingMatch[] = matches.map((m) => ({
    id: m.id,
    format: m.format,
    playedAt: m.teeTime?.startsAt ?? m.settledAt ?? m.createdAt,
    players: m.players.map((p) => ({ ...p, resultCents: p.resultCents ?? 0 })),
  }));

  const differentials = new Map<string, { playedAt: Date; differential: number }[]>();
  const gross = new Map<string, number[]>();
  for (const c of cards) {
    if (!differentials.has(c.userId)) differentials.set(c.userId, []);
    differentials.get(c.userId)!.push(c);
    if (!gross.has(c.userId)) gross.set(c.userId, []);
    gross.get(c.userId)!.push(c.grossScore);
  }

  // Everyone with something to show in this window; with no filters that's every golfer.
  const active = new Set([...rankingMatches.flatMap((m) => m.players.map((p) => p.userId)), ...gross.keys()]);
  const shown = since || courseId ? users.filter((u) => active.has(u.id)) : users;
  const byId = new Map(shown.map((u) => [u.id, u]));

  return rankGolfers([...byId.keys()], rankingMatches, differentials).map((r) => {
    const g = gross.get(r.userId);
    return {
      userId: r.userId,
      user: byId.get(r.userId)!,
      rank: r.rank,
      score: r.score,
      parts: r.parts,
      wins: r.wins,
      losses: r.losses,
      ties: r.ties,
      matchesPlayed: r.matchesPlayed,
      scoringAverage: g ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10) / 10 : null,
      earningsCents: r.earningsCents,
    };
  });
}

const byName = (a: LeaderboardRow, b: LeaderboardRow) => a.user.name.localeCompare(b.user.name);
const nullsLast = (a: number | null, b: number | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b);

const SORTERS: Record<LeaderboardSort, (a: LeaderboardRow, b: LeaderboardRow) => number> = {
  ranking: (a, b) => nullsLast(a.rank, b.rank) || b.matchesPlayed - a.matchesPlayed || byName(a, b),
  scoring: (a, b) => nullsLast(a.scoringAverage, b.scoringAverage) || byName(a, b),
  matches: (a, b) => b.wins - a.wins || a.losses - b.losses || b.matchesPlayed - a.matchesPlayed || byName(a, b),
  earnings: (a, b) => b.earningsCents - a.earningsCents || byName(a, b),
};

/** Leaderboard rows for every golfer in the window, sorted. Unranked golfers have rank null. */
export async function getLeaderboard(options: LeaderboardOptions = {}): Promise<LeaderboardRow[]> {
  const rows = await computeRows(options);
  return rows.sort(SORTERS[options.sort ?? "ranking"]);
}

/** One golfer's all-time ranking. */
export async function getUserRanking(userId: string): Promise<UserRanking> {
  const row = (await computeRows({})).find((r) => r.userId === userId);
  if (!row) {
    return { userId, rank: null, score: null, parts: null, wins: 0, losses: 0, ties: 0, scoringAverage: null, earningsCents: 0 };
  }
  const { rank, score, parts, wins, losses, ties, scoringAverage, earningsCents } = row;
  return { userId, rank, score, parts, wins, losses, ties, scoringAverage, earningsCents };
}
