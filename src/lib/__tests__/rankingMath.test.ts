import { describe, expect, it } from "vitest";
import {
  ELO_K,
  ELO_START,
  MIN_MATCHES,
  RANKING_WEIGHTS,
  UNVERIFIED_WEIGHT,
  handicapPriorRating,
  matchPairings,
  profitCurve,
  rankGolfers,
  recordFromPairings,
  replayElo,
  scaleTo100,
  scoringDifferential,
  smoothedWinRate,
  type RankingMatch,
} from "../rankingMath";

let seq = 0;
function singles(a: string, b: string, aResult: number, opts: { verified?: boolean; index?: number | null; day?: number } = {}): RankingMatch {
  seq++;
  return {
    id: `m${seq}`,
    format: "SINGLES_STROKE",
    playedAt: new Date(Date.UTC(2026, 0, opts.day ?? seq)),
    players: [
      { userId: a, side: 0, handicapIndex: opts.index ?? null, verifiedAtStart: opts.verified ?? true, resultCents: aResult },
      { userId: b, side: 1, handicapIndex: opts.index ?? null, verifiedAtStart: opts.verified ?? true, resultCents: -aResult },
    ],
  };
}

describe("weights and constants", () => {
  it("weights sum to 1", () => {
    const sum = Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("matches the published constants", () => {
    expect(UNVERIFIED_WEIGHT).toBe(0.6);
    expect(MIN_MATCHES).toBe(3);
    expect(handicapPriorRating(18)).toBe(1500);
    expect(handicapPriorRating(0)).toBe(1770);
  });
});

describe("smoothedWinRate", () => {
  it("is 50% with no matches", () => {
    expect(smoothedWinRate({ wins: 0, losses: 0, ties: 0 })).toBe(0.5);
  });

  it("pulls a perfect record toward 50%", () => {
    expect(smoothedWinRate({ wins: 3, losses: 0, ties: 0 })).toBeCloseTo(8 / 13);
    expect(smoothedWinRate({ wins: 30, losses: 0, ties: 0 })).toBeCloseTo(35 / 40);
  });

  it("counts ties as half a win", () => {
    expect(smoothedWinRate({ wins: 0, losses: 0, ties: 4 })).toBe(0.5);
    expect(smoothedWinRate({ wins: 1, losses: 1, ties: 2 })).toBe(0.5);
  });
});

describe("matchPairings", () => {
  it("singles: each player vs the other, outcome from own result", () => {
    const ps = matchPairings(singles("a", "b", 2000));
    expect(ps.map((p) => [p.userId, p.opponentId, p.outcome, p.share])).toEqual([
      ["a", "b", "W", 1],
      ["b", "a", "L", 1],
    ]);
  });

  it("fourball: both opposing players, each half a contest", () => {
    const m: RankingMatch = {
      id: "fb",
      format: "FOURBALL_MATCH",
      playedAt: new Date(),
      players: [
        { userId: "a", side: 0, handicapIndex: 5, verifiedAtStart: true, resultCents: 2000 },
        { userId: "b", side: 0, handicapIndex: 10, verifiedAtStart: true, resultCents: 2000 },
        { userId: "c", side: 1, handicapIndex: 8, verifiedAtStart: false, resultCents: -2000 },
        { userId: "d", side: 1, handicapIndex: 12, verifiedAtStart: true, resultCents: -2000 },
      ],
    };
    const ps = matchPairings(m);
    expect(ps.filter((p) => p.userId === "a").map((p) => p.opponentId)).toEqual(["c", "d"]);
    expect(recordFromPairings(ps.filter((p) => p.userId === "a"))).toEqual({ wins: 1, losses: 0, ties: 0 });
    expect(recordFromPairings(ps.filter((p) => p.userId === "d"))).toEqual({ wins: 0, losses: 1, ties: 0 });
  });

  it("threesome and nine point: pairwise comparison of results", () => {
    for (const format of ["THREESOME_STROKE", "NINE_POINT"] as const) {
      const m: RankingMatch = {
        id: format,
        format,
        playedAt: new Date(),
        players: [
          { userId: "a", side: 0, handicapIndex: null, verifiedAtStart: true, resultCents: 1000 },
          { userId: "b", side: 1, handicapIndex: null, verifiedAtStart: true, resultCents: 1000 },
          { userId: "c", side: 2, handicapIndex: null, verifiedAtStart: true, resultCents: -2000 },
        ],
      };
      const ps = matchPairings(m);
      // a and b both beat c and halve with each other, even though nobody "won" overall.
      expect(recordFromPairings(ps.filter((p) => p.userId === "a"))).toEqual({ wins: 1, losses: 0, ties: 1 });
      expect(recordFromPairings(ps.filter((p) => p.userId === "c"))).toEqual({ wins: 0, losses: 2, ties: 0 });
      expect(ps.every((p) => p.share === 1)).toBe(true);
    }
  });

  it("threesome: a smaller loss still beats a bigger loss", () => {
    const m: RankingMatch = {
      id: "t",
      format: "THREESOME_MATCH",
      playedAt: new Date(),
      players: [
        { userId: "a", side: 0, handicapIndex: null, verifiedAtStart: true, resultCents: 4000 },
        { userId: "b", side: 1, handicapIndex: null, verifiedAtStart: true, resultCents: -1000 },
        { userId: "c", side: 2, handicapIndex: null, verifiedAtStart: true, resultCents: -3000 },
      ],
    };
    const b = matchPairings(m).filter((p) => p.userId === "b");
    expect(b.map((p) => [p.opponentId, p.outcome])).toEqual([
      ["a", "L"],
      ["c", "W"],
    ]);
  });
});

describe("replayElo", () => {
  it("moves K/2 on an even first match against a verified opponent", () => {
    const r = replayElo([singles("a", "b", 2000)]);
    expect(r.get("a")).toBeCloseTo(ELO_START + ELO_K / 2);
    expect(r.get("b")).toBeCloseTo(ELO_START - ELO_K / 2);
  });

  it("counts a win over an unverified opponent at 60%", () => {
    const verified = replayElo([singles("a", "b", 2000, { verified: true })]).get("a")! - ELO_START;
    const unverified = replayElo([singles("a", "b", 2000, { verified: false })]).get("a")! - ELO_START;
    expect(unverified / verified).toBeCloseTo(UNVERIFIED_WEIGHT);
  });

  it("rates a win over a low handicap higher than over a high handicap", () => {
    const vsScratch = replayElo([singles("a", "b", 2000, { index: 0 })]).get("a")!;
    const vsHacker = replayElo([singles("a", "b", 2000, { index: 30 })]).get("a")!;
    expect(vsScratch).toBeGreaterThan(vsHacker);
  });

  it("replays in time order regardless of input order", () => {
    const m1 = singles("a", "b", 2000, { day: 1 });
    const m2 = singles("b", "c", 2000, { day: 2 });
    const m3 = singles("a", "c", -2000, { day: 3 });
    const forward = replayElo([m1, m2, m3]);
    const shuffled = replayElo([m3, m1, m2]);
    for (const id of ["a", "b", "c"]) expect(shuffled.get(id)).toBeCloseTo(forward.get(id)!);
  });

  it("a tie between equals changes nothing", () => {
    const r = replayElo([singles("a", "b", 0)]);
    expect(r.get("a")).toBe(ELO_START);
  });
});

describe("scaleTo100", () => {
  it("min-max scales to 0-100", () => {
    expect(scaleTo100([1, 2, 3])).toEqual([0, 50, 100]);
  });

  it("inverts when lower is better", () => {
    expect(scaleTo100([1, 2, 3], true)).toEqual([100, 50, 0]);
  });

  it("gives everyone 50 when all are equal or there's only one", () => {
    expect(scaleTo100([4, 4, 4])).toEqual([50, 50, 50]);
    expect(scaleTo100([7])).toEqual([50]);
    expect(scaleTo100([])).toEqual([]);
  });

  it("gives missing values 50", () => {
    expect(scaleTo100([null, 0, 10])).toEqual([50, 0, 100]);
    expect(scaleTo100([null, null])).toEqual([50, 50]);
  });
});

describe("scoringDifferential", () => {
  it("averages all when fewer than 8", () => {
    const d = [10, 12, 14].map((differential, i) => ({ differential, playedAt: new Date(2026, 0, i + 1) }));
    expect(scoringDifferential(d)).toBe(12);
  });

  it("uses the best 8 of the last 20", () => {
    // 25 rounds: the 5 oldest are great (0) but fall outside the window.
    const d = Array.from({ length: 25 }, (_, i) => ({ differential: i < 5 ? 0 : i, playedAt: new Date(2026, 0, i + 1) }));
    // Last 20 are 5..24; best 8 are 5..12.
    expect(scoringDifferential(d)).toBe((5 + 12) / 2);
  });

  it("is null with no rounds", () => {
    expect(scoringDifferential([])).toBeNull();
  });
});

describe("profitCurve", () => {
  it("is signed and compressive", () => {
    expect(profitCurve(0)).toBe(0);
    expect(profitCurve(900)).toBeCloseTo(1);
    expect(profitCurve(-900)).toBeCloseTo(-1);
    expect(profitCurve(9900)).toBeCloseTo(2);
  });
});

describe("rankGolfers", () => {
  const diffs = new Map<string, { playedAt: Date; differential: number }[]>();

  it("leaves golfers under the minimum unranked", () => {
    const matches = [singles("a", "b", 2000), singles("a", "b", 2000), singles("a", "c", 2000), singles("b", "c", 2000)];
    const r = rankGolfers(["a", "b", "c", "d"], matches, diffs);
    const by = Object.fromEntries(r.map((x) => [x.userId, x]));
    expect(by.a.matchesPlayed).toBe(3);
    expect(by.b.matchesPlayed).toBe(3);
    expect(by.c.matchesPlayed).toBe(2);
    expect(by.c.rank).toBeNull();
    expect(by.c.parts).toBeNull();
    expect(by.d.rank).toBeNull();
    expect(by.d.matchesPlayed).toBe(0);
    expect(by.a.rank).toBe(1);
    expect(by.b.rank).toBe(2);
    expect(by.a.wins).toBe(3);
    expect(by.b).toMatchObject({ wins: 1, losses: 2 });
    expect(by.a.earningsCents).toBe(6000);
  });

  it("scores the best golfer 100 on every part they lead", () => {
    const matches = [1, 2, 3].map(() => singles("a", "b", 2000));
    const d = new Map([
      ["a", [{ playedAt: new Date(), differential: 5 }]],
      ["b", [{ playedAt: new Date(), differential: 15 }]],
    ]);
    const [a, b] = rankGolfers(["a", "b"], matches, d);
    expect(a.parts).toEqual({ winLoss: 100, opponentStrength: 100, scoring: 100, profit: 100 });
    expect(a.score).toBe(100);
    expect(b.score).toBe(0);
  });

  it("ties share a rank", () => {
    const matches = [singles("a", "b", 0), singles("a", "b", 0), singles("a", "b", 0)];
    const r = rankGolfers(["a", "b"], matches, diffs);
    expect(r.map((x) => [x.rank, x.score])).toEqual([
      [1, 50],
      [1, 50],
    ]);
  });
});
