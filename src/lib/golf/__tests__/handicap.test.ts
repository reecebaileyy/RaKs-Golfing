import { describe, expect, it } from "vitest";
import {
  adjustedGrossScore,
  courseHandicap,
  handicapAllowance,
  handicapIndex,
  matchStrokes,
  roundHalfAway,
  scoreDifferential,
  strokesOnHole,
} from "../handicap";
import { HOLES, PARS, STROKE_INDEX } from "./helpers";

const flatTee = { courseRating: 72, slope: 113, par: 72 }; // course handicap = round(index)

describe("roundHalfAway", () => {
  it("rounds halves away from zero", () => {
    expect(roundHalfAway(2.5)).toBe(3);
    expect(roundHalfAway(-2.5)).toBe(-3);
    expect(roundHalfAway(2.49)).toBe(2);
    expect(roundHalfAway(10.15, 1)).toBe(10.2); // 10.15 is 10.149999... in floating point
    expect(roundHalfAway(-0.05, 1)).toBe(-0.1);
    expect(roundHalfAway(0)).toBe(0);
    expect(roundHalfAway(-0.04, 1)).toBe(0); // never -0
  });
});

describe("scoreDifferential", () => {
  it("applies (113 / slope) x (AGS - CR - PCC) and rounds to one decimal", () => {
    expect(scoreDifferential(90, { courseRating: 72.5, slope: 130 })).toBe(15.2); // 15.2115
    expect(scoreDifferential(85, { courseRating: 72.25, slope: 113 })).toBe(12.8); // 12.75 rounds up
    expect(scoreDifferential(85, { courseRating: 72, slope: 113 }, 1)).toBe(12);
    expect(scoreDifferential(85, { courseRating: 72, slope: 113 }, -1)).toBe(14);
    expect(scoreDifferential(70, { courseRating: 72.25, slope: 113 })).toBe(-2.3); // -2.25 rounds away from zero
    expect(scoreDifferential(100, { courseRating: 70.1, slope: 155 })).toBe(21.8); // 21.798
  });
});

describe("strokesOnHole", () => {
  it("gives strokes to the hardest holes first and wraps past 18", () => {
    expect(strokesOnHole(0, 1)).toBe(0);
    expect(strokesOnHole(1, 1)).toBe(1);
    expect(strokesOnHole(1, 2)).toBe(0);
    expect(strokesOnHole(18, 18)).toBe(1);
    expect(strokesOnHole(19, 1)).toBe(2);
    expect(strokesOnHole(19, 2)).toBe(1);
    expect(strokesOnHole(36, 18)).toBe(2);
    expect(strokesOnHole(40, 2)).toBe(3);
    expect(strokesOnHole(40, 4)).toBe(3);
    expect(strokesOnHole(40, 5)).toBe(2);
  });
  it("gives plus handicap strokes back on the easiest holes", () => {
    expect(strokesOnHole(-1, 18)).toBe(-1);
    expect(strokesOnHole(-1, 17)).toBe(0);
    expect(strokesOnHole(-2, 17)).toBe(-1);
    expect(strokesOnHole(-2, 1)).toBe(0);
  });
});

describe("adjustedGrossScore (net double bogey)", () => {
  const blowups = HOLES.map((h) => h.par + 6); // every hole far over the cap

  it("caps at par + 5 without a handicap", () => {
    expect(adjustedGrossScore(blowups, HOLES, null)).toBe(72 + 18 * 5);
  });

  it("caps at par + 2 + strokes received", () => {
    expect(adjustedGrossScore(blowups, HOLES, 0)).toBe(72 + 36);
    expect(adjustedGrossScore(blowups, HOLES, 18)).toBe(72 + 36 + 18);
    // 20: two strokes on SI 1 and 2, one elsewhere
    expect(adjustedGrossScore(blowups, HOLES, 20)).toBe(72 + 36 + 20);
    // 7 strokes on SI 1..7 only
    expect(adjustedGrossScore(blowups, HOLES, 7)).toBe(72 + 36 + 7);
  });

  it("checks the cap hole by hole", () => {
    // Handicap 1: only the SI 1 hole (hole 3, par 3) caps at 6; hole 6 (SI 17, par 4) caps at 6.
    const scores = HOLES.map((h) => h.par);
    scores[2] = 7; // hole 3: par 3 + 2 + 1 = 6
    scores[5] = 7; // hole 6: par 4 + 2 + 0 = 6
    expect(adjustedGrossScore(scores, HOLES, 1)).toBe(72 + 3 + 2);
  });

  it("takes strokes away on the easiest holes for a plus handicap", () => {
    const scores = HOLES.map((h) => h.par + 3);
    // -2: SI 17 and 18 cap at par + 1, every other hole at par + 2
    expect(adjustedGrossScore(scores, HOLES, -2)).toBe(72 + 16 * 2 + 2 * 1);
  });

  it("leaves scores under the cap alone", () => {
    const scores = HOLES.map((h) => h.par + 1);
    expect(adjustedGrossScore(scores, HOLES, null)).toBe(90);
    expect(adjustedGrossScore(scores, HOLES, 10)).toBe(90);
  });
});

describe("handicapIndex", () => {
  // Differentials 20.0, 21.0, 22.0, ... shuffled so ordering by value is tested.
  const make = (n: number) => {
    const values = Array.from({ length: n }, (_, i) => 20 + i);
    return values.map((v, i) => values[(i * 23) % n] ?? v);
  };
  const expected: Record<number, number> = {
    3: 18, // lowest 1 (20) - 2
    4: 19, // lowest 1 - 1
    5: 20,
    6: 19.5, // avg(20, 21) - 1
    7: 20.5,
    8: 20.5,
    9: 21, // avg(20, 21, 22)
    10: 21,
    11: 21,
    12: 21.5,
    13: 21.5,
    14: 21.5,
    15: 22,
    16: 22,
    17: 22.5,
    18: 22.5,
    19: 23,
    20: 23.5,
  };

  it("follows the WHS table for 3 to 20 scores", () => {
    for (let n = 3; n <= 20; n++) {
      const diffs = make(n);
      expect(new Set(diffs).size).toBe(n); // the shuffle is a permutation
      expect(handicapIndex(diffs), `${n} scores`).toBe(expected[n]);
    }
  });

  it("returns null with fewer than 3 scores", () => {
    expect(handicapIndex([])).toBeNull();
    expect(handicapIndex([10, 12])).toBeNull();
  });

  it("uses only the most recent 20", () => {
    const recent = make(20);
    const old = [0, 0, 0, 0, 0];
    expect(handicapIndex([...recent, ...old])).toBe(23.5);
  });

  it("rounds to one decimal and caps at 54", () => {
    expect(handicapIndex([10.1, 10.2, 30, 30, 30, 30, 30])).toBe(10.2); // avg 10.15
    expect(handicapIndex([10.1, 10.1, 10.2, 30, 30, 30, 30, 30, 30])).toBe(10.1); // 10.1333
    expect(handicapIndex([60, 61, 62, 63, 64])).toBe(54);
    expect(handicapIndex([55, 56, 57])).toBe(53); // 55 - 2, under the cap
  });

  it("supports plus handicaps", () => {
    expect(handicapIndex([-1.4, 2, 3])).toBe(-3.4);
    expect(handicapIndex([-1.5, -1.6, 0, 1, 2, 3])).toBe(-2.6); // avg -1.55 rounds to -1.6, minus 1
  });
});

describe("courseHandicap", () => {
  it("is index x slope / 113 + (CR - par), rounded", () => {
    expect(courseHandicap(12.1, { courseRating: 71.5, slope: 130, par: 72 })).toBe(13); // 13.42
    expect(courseHandicap(8.4, { courseRating: 70.2, slope: 125, par: 72 })).toBe(7); // 7.49
    expect(courseHandicap(20, { courseRating: 73.1, slope: 140, par: 72 })).toBe(26); // 25.88
    expect(courseHandicap(0.5, flatTee)).toBe(1); // half rounds up
    expect(courseHandicap(54, { courseRating: 74, slope: 155, par: 72 })).toBe(76);
  });

  it("supports plus handicaps", () => {
    expect(courseHandicap(-2, { courseRating: 73, slope: 125, par: 72 })).toBe(-1); // -1.21
    expect(courseHandicap(-3, { courseRating: 71.5, slope: 113, par: 72 })).toBe(-4); // -3.5 away from zero
    expect(courseHandicap(-1, { courseRating: 74, slope: 113, par: 72 })).toBe(1); // CR above par makes it positive
  });
});

describe("handicapAllowance", () => {
  it("matches the USGA recommendations", () => {
    expect(handicapAllowance("SINGLES_MATCH")).toBe(1);
    expect(handicapAllowance("SINGLES_STROKE")).toBe(0.95);
    expect(handicapAllowance("FOURBALL_MATCH")).toBe(0.9);
    expect(handicapAllowance("FOURBALL_STROKE")).toBe(0.85);
    expect(handicapAllowance("THREESOME_MATCH")).toBe(1);
    expect(handicapAllowance("THREESOME_STROKE")).toBe(0.95);
    expect(handicapAllowance("NINE_POINT")).toBe(1);
  });
});

describe("matchStrokes", () => {
  const strokesBySi = (strokes: number[]) => {
    const out: number[] = [];
    STROKE_INDEX.forEach((si, i) => (out[si - 1] = strokes[i]));
    return out;
  };

  it("gives the difference off the low, on the hardest holes", () => {
    const r = matchStrokes("SINGLES_MATCH", "NET", [{ id: "a", handicapIndex: 5 }, { id: "b", handicapIndex: 12 }], flatTee, HOLES);
    expect(r.a).toEqual({ courseHandicap: 5, playingHandicap: 5, strokes: Array(18).fill(0) });
    expect(r.b.courseHandicap).toBe(12);
    expect(strokesBySi(r.b.strokes)).toEqual([1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.b.strokes[2]).toBe(1); // hole 3 is SI 1
    expect(r.b.strokes[14]).toBe(0); // hole 15 is SI 18
  });

  it("wraps past 18 strokes", () => {
    const r = matchStrokes("SINGLES_MATCH", "NET", [{ id: "a", handicapIndex: 2 }, { id: "b", handicapIndex: 23 }], flatTee, HOLES);
    expect(r.b.strokes.reduce((s, x) => s + x, 0)).toBe(21);
    expect(strokesBySi(r.b.strokes)).toEqual([2, 2, 2, ...Array(15).fill(1)]);
  });

  it("applies the four-ball allowance before taking strokes off the low", () => {
    const players = [
      { id: "a1", handicapIndex: 10 }, // 9
      { id: "a2", handicapIndex: 15 }, // 13.5 -> 14
      { id: "b1", handicapIndex: 4 }, // 3.6 -> 4
      { id: "b2", handicapIndex: 20 }, // 18
    ];
    const r = matchStrokes("FOURBALL_MATCH", "NET", players, flatTee, HOLES);
    expect([r.a1, r.a2, r.b1, r.b2].map((p) => p.playingHandicap)).toEqual([9, 14, 4, 18]);
    const total = (id: string) => r[id].strokes.reduce((s, x) => s + x, 0);
    expect([total("a1"), total("a2"), total("b1"), total("b2")]).toEqual([5, 10, 0, 14]);

    const stroke = matchStrokes("FOURBALL_STROKE", "NET", players, flatTee, HOLES);
    // 85%: 8.5 -> 9, 12.75 -> 13, 3.4 -> 3, 17
    expect([stroke.a1, stroke.a2, stroke.b1, stroke.b2].map((p) => p.playingHandicap)).toEqual([9, 13, 3, 17]);
  });

  it("rounds a .5 playing handicap up", () => {
    const r = matchStrokes("SINGLES_STROKE", "NET", [{ id: "a", handicapIndex: 0 }, { id: "b", handicapIndex: 10 }], flatTee, HOLES);
    expect(r.b.playingHandicap).toBe(10); // 9.5 -> 10
  });

  it("handles a plus handicap as the low", () => {
    const r = matchStrokes("SINGLES_MATCH", "NET", [{ id: "a", handicapIndex: -2 }, { id: "b", handicapIndex: 10 }], flatTee, HOLES);
    expect(r.a.playingHandicap).toBe(-2);
    expect(r.a.strokes.every((s) => s === 0)).toBe(true);
    expect(r.b.strokes.reduce((s, x) => s + x, 0)).toBe(12);
  });

  it("gives everyone zero strokes for gross but still reports handicaps", () => {
    const r = matchStrokes("SINGLES_MATCH", "GROSS", [{ id: "a", handicapIndex: 2 }, { id: "b", handicapIndex: 23 }], flatTee, HOLES);
    expect(r.b).toEqual({ courseHandicap: 23, playingHandicap: 23, strokes: Array(18).fill(0) });
  });

  it("uses the course handicap from the tee", () => {
    const tee = { courseRating: 71.5, slope: 130, par: 72 };
    const r = matchStrokes("THREESOME_MATCH", "NET", [
      { id: "a", handicapIndex: 12.1 }, // 13
      { id: "b", handicapIndex: 8.4 }, // 9.66 - 0.5 = 9.16 -> 9
      { id: "c", handicapIndex: 20 }, // 23.0 - 0.5 = 22.5 -> 23
    ], tee, HOLES);
    expect([r.a.courseHandicap, r.b.courseHandicap, r.c.courseHandicap]).toEqual([13, 9, 23]);
    expect(r.c.strokes.reduce((s, x) => s + x, 0)).toBe(14);
    expect(PARS.length).toBe(18);
  });
});
