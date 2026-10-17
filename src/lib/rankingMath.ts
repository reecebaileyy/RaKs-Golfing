// Pure ranking math: who played whom, win/loss records, the strength-of-opponents rating and
// the 0-100 overall score. Nothing here touches the database, so every rule is unit tested.
import type { MatchFormat } from "./golf/types";

/** Reece's weights for the overall 0-100 score. They sum to 1. */
export const RANKING_WEIGHTS = {
  winLoss: 0.35,
  opponentStrength: 0.35,
  scoring: 0.15,
  profit: 0.15,
} as const;

/** Settled matches a golfer needs before they get a rank. */
export const MIN_MATCHES = 3;
/** Win rate is pulled toward 50% as if the golfer had this many extra matches at .500. */
export const WIN_RATE_PRIOR_MATCHES = 10;
export const ELO_START = 1500;
export const ELO_K = 32;
/** A result against an opponent who wasn't verified at the time counts this much. */
export const UNVERIFIED_WEIGHT = 0.6;
/** Rating a handicap index implies: 1500 + (18 - index) x 15, so a scratch golfer starts at 1770. */
export const HANDICAP_PRIOR_BASE_INDEX = 18;
export const HANDICAP_PRIOR_POINTS_PER_STROKE = 15;
/** How much of an opponent's expected strength comes from their frozen handicap (the rest is their Elo). */
export const HANDICAP_PRIOR_BLEND = 0.5;
/** Scoring uses the best this-many of the last SCORING_WINDOW differentials (like the WHS index). */
export const SCORING_BEST_OF = 8;
export const SCORING_WINDOW = 20;
/** Profit is squashed with sign(x) x log10(1 + |x| / PROFIT_LOG_SCALE_CENTS) before scaling. */
export const PROFIT_LOG_SCALE_CENTS = 100;

export type Outcome = "W" | "L" | "T";

export interface RankingMatchPlayer {
  userId: string;
  side: number;
  /** Frozen when the match was READY. */
  handicapIndex: number | null;
  verifiedAtStart: boolean;
  resultCents: number;
}

export interface RankingMatch {
  id: string;
  format: MatchFormat;
  playedAt: Date;
  players: RankingMatchPlayer[];
}

/** One golfer's result against one opponent in a match. */
export interface Pairing {
  matchId: string;
  userId: string;
  opponentId: string;
  outcome: Outcome;
  opponentIndex: number | null;
  opponentVerified: boolean;
  /**
   * Share of one contest this pairing stands for: 1 when it's a contest of its own
   * (singles, each pair of a threesome), 1/2 for each opponent of a 2v2 team match.
   */
  share: number;
}

const THREE_PLAYER: MatchFormat[] = ["NINE_POINT", "THREESOME_STROKE", "THREESOME_MATCH"];

export function isThreePlayer(format: MatchFormat): boolean {
  return THREE_PLAYER.includes(format);
}

function sign(cents: number): Outcome {
  return cents > 0 ? "W" : cents < 0 ? "L" : "T";
}

/**
 * Every golfer's pairings in a match. Two-sided formats read the outcome from the golfer's own
 * result; three-player games compare each pair's results (higher result = win).
 */
export function matchPairings(match: RankingMatch): Pairing[] {
  const out: Pairing[] = [];
  const threePlayer = isThreePlayer(match.format);
  for (const p of match.players) {
    const opponents = match.players.filter((o) => (threePlayer ? o.userId !== p.userId : o.side !== p.side));
    for (const o of opponents) {
      out.push({
        matchId: match.id,
        userId: p.userId,
        opponentId: o.userId,
        outcome: threePlayer ? sign(p.resultCents - o.resultCents) : sign(p.resultCents),
        opponentIndex: o.handicapIndex,
        opponentVerified: o.verifiedAtStart,
        share: threePlayer ? 1 : 1 / opponents.length,
      });
    }
  }
  return out;
}

export interface Record3 {
  wins: number;
  losses: number;
  ties: number;
}

/**
 * Win/loss/tie record from pairings. A 2v2 match is one contest, so its two pairings
 * (same outcome) count once; each pair in a threesome is its own contest.
 */
export function recordFromPairings(pairings: Pairing[]): Record3 {
  const r = { wins: 0, losses: 0, ties: 0 };
  for (const p of pairings) {
    const key = p.outcome === "W" ? "wins" : p.outcome === "L" ? "losses" : "ties";
    r[key] += p.share;
  }
  // Shares of a team match add back up to whole contests; round off float dust.
  return { wins: Math.round(r.wins), losses: Math.round(r.losses), ties: Math.round(r.ties) };
}

/** Win rate with ties as half a win, smoothed toward 50% with WIN_RATE_PRIOR_MATCHES phantom matches. */
export function smoothedWinRate({ wins, losses, ties }: Record3, prior = WIN_RATE_PRIOR_MATCHES): number {
  const played = wins + losses + ties;
  return (wins + ties / 2 + prior * 0.5) / (played + prior);
}

/** Starting rating implied by a handicap index; lower index = stronger. */
export function handicapPriorRating(index: number): number {
  return ELO_START + (HANDICAP_PRIOR_BASE_INDEX - index) * HANDICAP_PRIOR_POINTS_PER_STROKE;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

const OUTCOME_SCORE: Record<Outcome, number> = { W: 1, T: 0.5, L: 0 };

/**
 * Replays every match in time order and returns each golfer's final Elo rating.
 * An opponent's expected strength blends their current rating with the rating their frozen
 * handicap implies. Each result's K is scaled by UNVERIFIED_WEIGHT when the opponent wasn't
 * verified at the time, and by the pairing's share (a 2v2 result is split across both opponents).
 * Everyone in a match is updated from pre-match ratings.
 */
export function replayElo(matches: RankingMatch[]): Map<string, number> {
  const ratings = new Map<string, number>();
  const get = (id: string) => ratings.get(id) ?? ELO_START;
  const ordered = [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id.localeCompare(b.id));
  for (const match of ordered) {
    const delta = new Map<string, number>();
    for (const p of matchPairings(match)) {
      const current = get(p.opponentId);
      const opponent =
        p.opponentIndex == null
          ? current
          : HANDICAP_PRIOR_BLEND * handicapPriorRating(p.opponentIndex) + (1 - HANDICAP_PRIOR_BLEND) * current;
      const k = ELO_K * (p.opponentVerified ? 1 : UNVERIFIED_WEIGHT) * p.share;
      const change = k * (OUTCOME_SCORE[p.outcome] - expectedScore(get(p.userId), opponent));
      delta.set(p.userId, (delta.get(p.userId) ?? 0) + change);
    }
    for (const [id, d] of delta) ratings.set(id, get(id) + d);
  }
  return ratings;
}

/** Average of the best SCORING_BEST_OF of the last SCORING_WINDOW differentials (all of them if fewer). */
export function scoringDifferential(differentials: { playedAt: Date; differential: number }[]): number | null {
  if (differentials.length === 0) return null;
  const recent = [...differentials]
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .slice(0, SCORING_WINDOW)
    .map((d) => d.differential)
    .sort((a, b) => a - b);
  const best = recent.slice(0, Math.min(SCORING_BEST_OF, recent.length));
  return best.reduce((a, b) => a + b, 0) / best.length;
}

/** sign(x) x log10(1 + |x| / 100), so a few big wins don't swamp everything else. */
export function profitCurve(cents: number): number {
  return Math.sign(cents) * Math.log10(1 + Math.abs(cents) / PROFIT_LOG_SCALE_CENTS);
}

/**
 * Min-max scales values to 0-100 (100 = best). If every value is the same, all get 50.
 * Missing values (null) get 50 too, so a golfer with no rounds yet sits in the middle.
 */
export function scaleTo100(values: (number | null)[], lowerIsBetter = false): number[] {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return values.map(() => 50);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((v) => {
    if (v == null || max === min) return 50;
    const t = (v - min) / (max - min);
    return (lowerIsBetter ? 1 - t : t) * 100;
  });
}

export interface RankingParts {
  winLoss: number;
  opponentStrength: number;
  scoring: number;
  profit: number;
}

export function overallScore(parts: RankingParts): number {
  return (
    parts.winLoss * RANKING_WEIGHTS.winLoss +
    parts.opponentStrength * RANKING_WEIGHTS.opponentStrength +
    parts.scoring * RANKING_WEIGHTS.scoring +
    parts.profit * RANKING_WEIGHTS.profit
  );
}

export interface GolferStats extends Record3 {
  userId: string;
  matchesPlayed: number;
  earningsCents: number;
  /** Best-8-of-20 differential average, or null with no rounds. */
  differential: number | null;
}

export interface GolferRanking extends GolferStats {
  rank: number | null;
  score: number | null;
  parts: RankingParts | null;
  rating: number;
}

/** Builds each golfer's record, earnings and match count from settled matches. */
export function golferStats(
  userIds: string[],
  matches: RankingMatch[],
  differentials: Map<string, { playedAt: Date; differential: number }[]>,
): GolferStats[] {
  const pairingsByUser = new Map<string, Pairing[]>();
  const played = new Map<string, number>();
  const earnings = new Map<string, number>();
  for (const m of matches) {
    for (const p of m.players) {
      played.set(p.userId, (played.get(p.userId) ?? 0) + 1);
      earnings.set(p.userId, (earnings.get(p.userId) ?? 0) + p.resultCents);
    }
    for (const p of matchPairings(m)) {
      const list = pairingsByUser.get(p.userId) ?? [];
      list.push(p);
      pairingsByUser.set(p.userId, list);
    }
  }
  return userIds.map((userId) => ({
    userId,
    ...recordFromPairings(pairingsByUser.get(userId) ?? []),
    matchesPlayed: played.get(userId) ?? 0,
    earningsCents: earnings.get(userId) ?? 0,
    differential: scoringDifferential(differentials.get(userId) ?? []),
  }));
}

/**
 * Ranks golfers. Only golfers with MIN_MATCHES settled matches are ranked; each part is
 * scaled 0-100 across the ranked golfers only. Equal scores share a rank (1, 2, 2, 4).
 */
export function rankGolfers(
  userIds: string[],
  matches: RankingMatch[],
  differentials: Map<string, { playedAt: Date; differential: number }[]>,
): GolferRanking[] {
  const stats = golferStats(userIds, matches, differentials);
  const ratings = replayElo(matches);
  const eligible = stats.filter((s) => s.matchesPlayed >= MIN_MATCHES);

  const winLoss = scaleTo100(eligible.map((s) => smoothedWinRate(s)));
  const strength = scaleTo100(eligible.map((s) => ratings.get(s.userId) ?? ELO_START));
  const scoring = scaleTo100(eligible.map((s) => s.differential), true);
  const profit = scaleTo100(eligible.map((s) => profitCurve(s.earningsCents)));

  const scored = new Map<string, { parts: RankingParts; score: number }>();
  eligible.forEach((s, i) => {
    const parts = { winLoss: winLoss[i], opponentStrength: strength[i], scoring: scoring[i], profit: profit[i] };
    scored.set(s.userId, { parts: roundParts(parts), score: round1(overallScore(parts)) });
  });

  const scores = [...scored.values()].map((s) => s.score);
  return stats.map((s) => {
    const r = scored.get(s.userId);
    return {
      ...s,
      rating: ratings.get(s.userId) ?? ELO_START,
      parts: r?.parts ?? null,
      score: r?.score ?? null,
      rank: r ? 1 + scores.filter((x) => x > r.score).length : null,
    };
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundParts(p: RankingParts): RankingParts {
  return {
    winLoss: round1(p.winLoss),
    opponentStrength: round1(p.opponentStrength),
    scoring: round1(p.scoring),
    profit: round1(p.profit),
  };
}
