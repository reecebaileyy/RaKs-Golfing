import { describe, expect, it } from "vitest";
import {
  POINT_VALUES,
  maxLossCents,
  netTransfers,
  ninePointPayouts,
  pressHoldCents,
  resolvePointVote,
  settleMatch,
} from "../settlement";
import type { MatchFormat, MatchScoringInput, Settlement } from "../types";
import { card, makeInput, rng } from "./helpers";

const STAKE = 2000;
const sum = (s: Settlement) => Object.values(s.payouts).reduce((t, c) => t + c, 0);

const singles = (format: MatchFormat, a: (number | null)[], b: (number | null)[], presses: MatchScoringInput["presses"] = []) =>
  makeInput({ format, players: [["a", 0], ["b", 1]], gross: { a, b }, presses, stakeCents: STAKE });

describe("settleMatch basics", () => {
  it("refuses an unfinished match", () => {
    expect(() => settleMatch(singles("SINGLES_MATCH", card(4, {}, 17), card(4)))).toThrow("isn't finished");
  });

  it("loser pays the stake in singles", () => {
    const s = settleMatch(singles("SINGLES_MATCH", card(4, { 1: 3 }), card(4)));
    expect(s.payouts).toEqual({ a: 2000, b: -2000 });
    expect(s.transfers).toEqual([{ from: "b", to: "a", cents: 2000 }]);
    expect(s.lines).toContain("b pays a $20.00");
    expect(s.pressOutcomes).toEqual([]);
  });

  it("a halved match moves no money", () => {
    const s = settleMatch(singles("SINGLES_MATCH", card(4), card(4)));
    expect(s.payouts).toEqual({ a: 0, b: 0 });
    expect(s.transfers).toEqual([]);
  });

  it("stroke play: lower total wins, a net tie pays nothing", () => {
    expect(settleMatch(singles("SINGLES_STROKE", card(5), card(4, { 7: 6 }))).payouts).toEqual({ a: -2000, b: 2000 });
    const strokes = { a: Array(18).fill(0), b: Array(18).fill(1) };
    const tie = makeInput({
      format: "SINGLES_STROKE",
      players: [["a", 0], ["b", 1]],
      gross: { a: card(4), b: card(5) },
      strokes,
    });
    expect(settleMatch(tie).payouts).toEqual({ a: 0, b: 0 });
  });

  it("four-ball: each loser pays the stake, each winner receives it", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players: [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]],
      gross: { a1: card(5), a2: card(5), b1: card(4), b2: card(6) },
      stakeCents: STAKE,
    });
    const s = settleMatch(input);
    expect(s.payouts).toEqual({ a1: -2000, a2: -2000, b1: 2000, b2: 2000 });
    expect(s.transfers).toEqual([
      { from: "a1", to: "b1", cents: 2000 },
      { from: "a2", to: "b2", cents: 2000 },
    ]);
  });

  it("threesome: each pairing settles on its own", () => {
    const input = makeInput({
      format: "THREESOME_STROKE",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4), b: card(5), c: card(6) },
      stakeCents: STAKE,
    });
    const s = settleMatch(input);
    expect(s.payouts).toEqual({ a: 4000, b: 0, c: -4000 });
    expect(s.transfers).toEqual([
      { from: "b", to: "a", cents: 2000 },
      { from: "c", to: "a", cents: 2000 },
      { from: "c", to: "b", cents: 2000 },
    ]);
    expect(sum(s)).toBe(0);
  });
});

describe("press settlement, match play", () => {
  // a wins 1-4, closed out 4&3 after 15; b presses 16.
  const closedOut = (b16: number) =>
    singles("SINGLES_MATCH", card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }), card(4, { 16: b16 }), [{ side: 1, opponentSide: 0, holeNumber: 16 }]);

  it("WON: the pairing is washed", () => {
    const s = settleMatch(closedOut(3));
    expect(s.pressOutcomes).toEqual(["WON"]);
    expect(s.payouts).toEqual({ a: 0, b: 0 });
    expect(s.lines.some((l) => l.includes("washed"))).toBe(true);
  });

  it("TIED: the match stands", () => {
    const s = settleMatch(closedOut(4));
    expect(s.pressOutcomes).toEqual(["TIED"]);
    expect(s.payouts).toEqual({ a: 2000, b: -2000 });
  });

  it("LOST: the press side pays double", () => {
    const s = settleMatch(closedOut(5));
    expect(s.pressOutcomes).toEqual(["LOST"]);
    expect(s.payouts).toEqual({ a: 4000, b: -4000 });
    expect(s.lines).toContain("b pays a $40.00");
  });

  it("only the pressed hole counts, not holes after it", () => {
    // b wins 17 and 18 after losing the press on 16: still pays double, a still won 4&3.
    const input = singles(
      "SINGLES_MATCH",
      card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }),
      card(4, { 16: 5, 17: 3, 18: 3 }),
      [{ side: 1, opponentSide: 0, holeNumber: 16 }],
    );
    expect(settleMatch(input).payouts).toEqual({ a: 4000, b: -4000 });
  });

  describe("press on 18 while the match is alive (b 1 down thru 17)", () => {
    const at18 = (b18: number) =>
      singles("SINGLES_MATCH", card(4, { 1: 3 }), card(4, { 18: b18 }), [{ side: 1, opponentSide: 0, holeNumber: 18 }]);

    it("WON: b halves the match, washed", () => {
      const s = settleMatch(at18(3));
      expect(s.pressOutcomes).toEqual(["WON"]);
      expect(s.payouts).toEqual({ a: 0, b: 0 });
    });
    it("TIED: a wins 1 UP", () => {
      const s = settleMatch(at18(4));
      expect(s.pressOutcomes).toEqual(["TIED"]);
      expect(s.payouts).toEqual({ a: 2000, b: -2000 });
    });
    it("LOST: b pays double", () => {
      const s = settleMatch(at18(5));
      expect(s.pressOutcomes).toEqual(["LOST"]);
      expect(s.payouts).toEqual({ a: 4000, b: -4000 });
    });
  });

  it("four-ball: every player on the press side pays double", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players: [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]],
      gross: { a1: card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }), a2: card(5), b1: card(4, { 17: 5 }), b2: card(5) },
      presses: [{ side: 1, opponentSide: 0, holeNumber: 17 }],
      stakeCents: STAKE,
    });
    const s = settleMatch(input);
    expect(s.pressOutcomes).toEqual(["LOST"]);
    expect(s.payouts).toEqual({ a1: 4000, a2: 4000, b1: -4000, b2: -4000 });
  });

  it("four-ball: a press won on the side's best ball washes the match", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players: [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]],
      gross: { a1: card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }), a2: card(5), b1: card(4), b2: card(5, { 17: 3 }) },
      presses: [{ side: 1, opponentSide: 0, holeNumber: 17 }],
      stakeCents: STAKE,
    });
    const s = settleMatch(input);
    expect(s.pressOutcomes).toEqual(["WON"]);
    expect(s.payouts).toEqual({ a1: 0, a2: 0, b1: 0, b2: 0 });
  });

  it("threesome: a press only changes its own pairing", () => {
    // a beats b and c 4&3; c presses a on 16 and loses it. b presses a on 17 and wins it.
    const input = makeInput({
      format: "THREESOME_MATCH",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }), b: card(4, { 17: 3 }), c: card(4, { 16: 5 }) },
      presses: [
        { side: 2, opponentSide: 0, holeNumber: 16 },
        { side: 1, opponentSide: 0, holeNumber: 17 },
      ],
      stakeCents: STAKE,
    });
    const s = settleMatch(input);
    expect(s.pressOutcomes).toEqual(["LOST", "WON"]);
    // a-b washed; a-c doubled; b-c: b wins 17, c loses 16 -> b 2 UP over c.
    expect(s.payouts).toEqual({ a: 4000, b: 2000, c: -6000 });
    expect(sum(s)).toBe(0);
  });
});

describe("press settlement, stroke play", () => {
  // a leads by 2 thru 17; b presses 18.
  const at18 = (a18: number, b18: number) =>
    singles("SINGLES_STROKE", card(4, { 1: 3, 2: 3, 18: a18 }), card(4, { 18: b18 }), [{ side: 1, opponentSide: 0, holeNumber: 18 }]);

  it("WON: b wins the hole but still loses the match, washed", () => {
    const s = settleMatch(at18(5, 4));
    expect(s.pressOutcomes).toEqual(["WON"]);
    expect(s.payouts).toEqual({ a: 0, b: 0 });
  });

  it("MOOT: b wins the hole and ties the match, nobody pays", () => {
    const s = settleMatch(at18(6, 4));
    expect(s.pressOutcomes).toEqual(["MOOT"]);
    expect(s.payouts).toEqual({ a: 0, b: 0 });
  });

  it("MOOT: b wins the hole and the match, a pays the normal stake", () => {
    const s = settleMatch(at18(7, 4));
    expect(s.pressOutcomes).toEqual(["MOOT"]);
    expect(s.payouts).toEqual({ a: -2000, b: 2000 });
  });

  it("TIED: the match stands", () => {
    const s = settleMatch(at18(4, 4));
    expect(s.pressOutcomes).toEqual(["TIED"]);
    expect(s.payouts).toEqual({ a: 2000, b: -2000 });
  });

  it("LOST: b pays double", () => {
    const s = settleMatch(at18(4, 5));
    expect(s.pressOutcomes).toEqual(["LOST"]);
    expect(s.payouts).toEqual({ a: 4000, b: -4000 });
  });

  it("four-ball: compares the sides' best balls on the pressed hole", () => {
    const input = (b2on18: number) =>
      makeInput({
        format: "FOURBALL_STROKE",
        players: [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]],
        gross: { a1: card(4, { 1: 3 }), a2: card(5), b1: card(4), b2: card(5, { 18: b2on18 }) },
        presses: [{ side: 1, opponentSide: 0, holeNumber: 18 }],
        stakeCents: STAKE,
      });
    // b2 makes 3: b wins 18 by 1 and ties the match -> MOOT, no money.
    expect(settleMatch(input(3))).toMatchObject({ pressOutcomes: ["MOOT"], payouts: { a1: 0, a2: 0, b1: 0, b2: 0 } });
    // b2 makes 2: b wins the match by 1 -> MOOT, normal result.
    expect(settleMatch(input(2)).payouts).toEqual({ a1: -2000, a2: -2000, b1: 2000, b2: 2000 });
    // b's best is b1's 4 against a1's 4 -> TIED.
    expect(settleMatch(input(6))).toMatchObject({ pressOutcomes: ["TIED"], payouts: { a1: 2000, b1: -2000 } });
  });
});

describe("nine point", () => {
  const ninePoint = (a: number, b: number, c: number, pointValueCents: number, stakeCents: number) =>
    makeInput({
      format: "NINE_POINT",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(a), b: card(b), c: card(c) },
      pointValueCents,
      stakeCents,
    });

  it("settles every pair on the point difference", () => {
    // a 5 points a hole (90), b 3 (54), c 1 (18).
    const s = settleMatch(ninePoint(3, 4, 5, 100, 50000));
    expect(s.payouts).toEqual({ a: 10800, b: 0, c: -10800 });
    expect(s.transfers).toEqual([{ from: "c", to: "a", cents: 10800 }]);
  });

  it("caps the loss at the stake", () => {
    const s = settleMatch(ninePoint(3, 4, 5, 100, 2000));
    expect(s.payouts).toEqual({ a: 2000, b: 0, c: -2000 });
    expect(s.lines.some((l) => l.includes("capped"))).toBe(true);
  });

  it("all square moves no money", () => {
    const s = settleMatch(ninePoint(4, 4, 4, 500, 2000));
    expect(s.payouts).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("needs a point value and has no presses", () => {
    expect(() => settleMatch(ninePoint(4, 4, 4, null as unknown as number, 2000))).toThrow("point value");
    const pressed = { ...ninePoint(4, 4, 4, 100, 2000), presses: [{ side: 1, opponentSide: 0, holeNumber: 18 }] };
    expect(() => settleMatch(pressed)).toThrow("no presses");
  });

  it("reduces several winners proportionally and gives the leftover cent to the biggest", () => {
    // raw: a +7800, b +1800, c -9600; capped at 5000.
    const { payouts, capped } = ninePointPayouts({ a: 80, b: 60, c: 22 }, 100, 5000);
    expect(capped).toBe(true);
    expect(payouts).toEqual({ a: 4063, b: 937, c: -5000 });
  });

  it("caps two losers independently", () => {
    // raw: a +12000, b -4800, c -7200 at $1; cap 5000 -> b -4800, c -5000, a +9800.
    expect(ninePointPayouts({ a: 94, b: 38, c: 30 }, 100, 5000).payouts).toEqual({ a: 9800, b: -4800, c: -5000 });
  });

  it("always sums to zero and respects the cap (random rounds)", () => {
    const next = rng(42);
    for (let trial = 0; trial < 500; trial++) {
      const gross = { a: [] as number[], b: [] as number[], c: [] as number[] };
      for (let h = 0; h < 18; h++) for (const id of ["a", "b", "c"] as const) gross[id].push(3 + Math.floor(next() * 5));
      const pointValueCents = POINT_VALUES[Math.floor(next() * 3)];
      const stakeCents = 2000 + Math.floor(next() * 20) * 500 + Math.floor(next() * 100);
      const input = makeInput({ format: "NINE_POINT", players: [["a", 0], ["b", 1], ["c", 2]], gross, pointValueCents, stakeCents });
      const s = settleMatch(input);
      expect(sum(s)).toBe(0);
      for (const c of Object.values(s.payouts)) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(-stakeCents);
      }
      // Transfers move exactly the payouts.
      const fromTransfers: Record<string, number> = { a: 0, b: 0, c: 0 };
      for (const t of s.transfers!) {
        expect(t.cents).toBeGreaterThan(0);
        fromTransfers[t.from] -= t.cents;
        fromTransfers[t.to] += t.cents;
      }
      expect(fromTransfers).toEqual(s.payouts);
    }
  });

  it("never pays a winner more than the points earned (random totals)", () => {
    const next = rng(7);
    for (let trial = 0; trial < 1000; trial++) {
      const a = Math.floor(next() * 90);
      const b = Math.floor(next() * (162 - a));
      const totals = { a, b, c: 162 - a - b };
      const value = POINT_VALUES[Math.floor(next() * 3)];
      const cap = 100 + Math.floor(next() * 20000);
      const capped = ninePointPayouts(totals, value, cap).payouts;
      const raw = ninePointPayouts(totals, value, Number.MAX_SAFE_INTEGER).payouts;
      expect(Object.values(capped).reduce((t, c) => t + c, 0)).toBe(0);
      for (const id of ["a", "b", "c"]) {
        if (raw[id] > 0) {
          expect(capped[id]).toBeLessThanOrEqual(raw[id]);
          expect(capped[id]).toBeGreaterThanOrEqual(0);
        } else {
          expect(capped[id]).toBe(Math.max(raw[id], -cap));
        }
      }
    }
  });
});

describe("netTransfers", () => {
  it("pays the biggest winner first", () => {
    expect(netTransfers({ a: 500, b: 300, c: -800 })).toEqual([
      { from: "c", to: "a", cents: 500 },
      { from: "c", to: "b", cents: 300 },
    ]);
    expect(netTransfers({ a: 800, b: -300, c: -500 })).toEqual([
      { from: "c", to: "a", cents: 500 },
      { from: "b", to: "a", cents: 300 },
    ]);
  });
});

describe("holds", () => {
  it("holds the most a player can lose at booking", () => {
    expect(maxLossCents("SINGLES_MATCH", 2000)).toBe(2000);
    expect(maxLossCents("SINGLES_STROKE", 2000)).toBe(2000);
    expect(maxLossCents("FOURBALL_MATCH", 2000)).toBe(2000);
    expect(maxLossCents("FOURBALL_STROKE", 2000)).toBe(2000);
    expect(maxLossCents("THREESOME_MATCH", 2000)).toBe(4000);
    expect(maxLossCents("THREESOME_STROKE", 2500)).toBe(5000);
    expect(maxLossCents("NINE_POINT", 3000)).toBe(3000);
  });

  it("holds one more stake for a press", () => {
    expect(pressHoldCents(2000)).toBe(2000);
  });

  it("never settles a loss beyond what was held (random singles and threesomes with presses)", () => {
    const next = rng(99);
    for (let trial = 0; trial < 300; trial++) {
      const three = next() < 0.5;
      const format: MatchFormat = three
        ? next() < 0.5 ? "THREESOME_MATCH" : "THREESOME_STROKE"
        : next() < 0.5 ? "SINGLES_MATCH" : "SINGLES_STROKE";
      const ids = three ? ["a", "b", "c"] : ["a", "b"];
      const gross: Record<string, number[]> = {};
      for (const id of ids) gross[id] = Array.from({ length: 18 }, () => 3 + Math.floor(next() * 4));
      const input = makeInput({ format, players: ids.map((id, i) => [id, i] as [string, number]), gross, stakeCents: STAKE });
      const s = settleMatch(input);
      expect(sum(s)).toBe(0);
      for (const c of Object.values(s.payouts)) expect(-c).toBeLessThanOrEqual(maxLossCents(format, STAKE));
    }
  });
});

describe("resolvePointVote", () => {
  it("waits for everyone", () => {
    expect(resolvePointVote([100, 300, null])).toBeNull();
    expect(resolvePointVote([100, undefined, 300])).toBeNull();
    expect(resolvePointVote([])).toBeNull();
  });
  it("takes the majority", () => {
    expect(resolvePointVote([500, 500, 100])).toBe(500);
    expect(resolvePointVote([300, 100, 300])).toBe(300);
    expect(resolvePointVote([100, 100, 100])).toBe(100);
  });
  it("takes the lowest when all three differ", () => {
    expect(resolvePointVote([500, 100, 300])).toBe(100);
  });
  it("rejects values that aren't on the menu", () => {
    expect(() => resolvePointVote([100, 200, 300])).toThrow();
  });
  it("exports the point values", () => {
    expect(POINT_VALUES).toEqual([100, 300, 500]);
  });
});
