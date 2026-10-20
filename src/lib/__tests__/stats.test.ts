import { describe, expect, it } from "vitest";
import { coursesPlayed, holeStrokesError, matchRecord, resultText, scoringStats, sparklinePoints, toPar } from "../stats";

const card = (courseId: string, grossScore: number, differential: number) => ({
  courseId,
  courseName: courseId.toUpperCase(),
  grossScore,
  differential,
  playedAt: new Date("2026-01-01"),
});

describe("scoringStats", () => {
  it("is empty without rounds", () => {
    expect(scoringStats([])).toEqual({ rounds: 0, scoringAverage: null, bestRound: null, averageDifferential: null });
  });
  it("averages and finds the best round", () => {
    const s = scoringStats([card("a", 90, 15), card("a", 84, 9.5), card("b", 87, 12)]);
    expect(s).toEqual({ rounds: 3, scoringAverage: 87, bestRound: 84, averageDifferential: 12.2 });
  });
});

describe("coursesPlayed", () => {
  it("counts rounds per course, most played first", () => {
    const list = coursesPlayed([card("b", 90, 1), card("a", 90, 1), card("a", 90, 1)]);
    expect(list.map((c) => [c.courseId, c.rounds])).toEqual([["a", 2], ["b", 1]]);
  });
});

describe("matchRecord", () => {
  it("splits wins, losses and ties and skips unsettled results", () => {
    expect(matchRecord([500, -500, 0, null, 2000])).toEqual({ wins: 2, losses: 1, ties: 1 });
  });
});

describe("sparklinePoints", () => {
  it("returns nothing for no values", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });
  it("centers a flat line", () => {
    expect(sparklinePoints([5, 5], 100, 20)).toBe("4,10 96,10");
  });
  it("plots higher values higher on screen", () => {
    const [low, high] = sparklinePoints([1, 9], 100, 20).split(" ").map((p) => Number(p.split(",")[1]));
    expect(high).toBeLessThan(low);
  });
});

describe("holeStrokesError", () => {
  it("needs 18 whole scores from 1 to 20", () => {
    expect(holeStrokesError(Array(18).fill(5))).toBeNull();
    expect(holeStrokesError(Array(17).fill(5))).not.toBeNull();
    expect(holeStrokesError([...Array(17).fill(5), 0])).not.toBeNull();
    expect(holeStrokesError([...Array(17).fill(5), 4.5])).not.toBeNull();
    expect(holeStrokesError([...Array(17).fill(5), 21])).not.toBeNull();
  });
});

describe("display helpers", () => {
  it("formats results and score to par", () => {
    const fmt = (c: number) => `$${c / 100}`;
    expect(resultText(1200, fmt)).toBe("+$12");
    expect(resultText(-500, fmt)).toBe("-$5");
    expect(resultText(0, fmt)).toBe("Even");
    expect(resultText(null, fmt)).toBe("No result");
    expect(toPar(72, 72)).toBe("E");
    expect(toPar(80, 72)).toBe("+8");
    expect(toPar(70, 72)).toBe("-2");
  });
});
