import { describe, expect, it } from "vitest";
import { computeMatchState, ninePointHole } from "../scoring";
import { card, makeInput } from "./helpers";

const singles = (a: (number | null)[], b: (number | null)[], format: "SINGLES_MATCH" | "SINGLES_STROKE" = "SINGLES_MATCH") =>
  makeInput({ format, players: [["a", 0], ["b", 1]], gross: { a, b } });

describe("match play", () => {
  it("closes out 4&3 and fixes the result while later holes fill in", () => {
    const input = singles(card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }), card(4, { 16: 3, 17: 3, 18: 3 }));
    const p = computeMatchState(input).pairings[0];
    expect(p.closedOut).toBe(true);
    expect(p.winnerSide).toBe(0);
    expect(p.margin).toBe(4);
    expect(p.summary).toBe("Side A wins 4&3");
    expect(p.holesCompleted).toBe(18);
    expect(p.holeWinners.slice(15)).toEqual([1, 1, 1]);
  });

  it("is decided as soon as it is closed out, before the other holes are played", () => {
    const p = computeMatchState(singles(card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }, 15), card(4, {}, 15))).pairings[0];
    expect(p.summary).toBe("Side A wins 4&3");
    expect(p.winnerSide).toBe(0);
    expect(p.holeWinners[15]).toBeUndefined();
  });

  it("is still alive when dormie", () => {
    const p = computeMatchState(singles(card(4, {}, 15), card(4, { 1: 5, 2: 5, 3: 5 }, 15))).pairings[0];
    expect(p.closedOut).toBe(false);
    expect(p.winnerSide).toBeUndefined();
    expect(p.summary).toBe("Side A 3 UP thru 15");
    // Halving the 16th closes it out 3&2.
    const after = computeMatchState(singles(card(4, {}, 16), card(4, { 1: 5, 2: 5, 3: 5 }, 16))).pairings[0];
    expect(after.summary).toBe("Side A wins 3&2");
  });

  it("reports all square and who is up from either side", () => {
    expect(computeMatchState(singles(card(4, { 1: 3 }, 9), card(4, { 2: 3 }, 9))).pairings[0].summary).toBe("All square thru 9");
    const down = computeMatchState(singles(card(5, {}, 7), card(5, { 3: 4, 6: 4 }, 7))).pairings[0];
    expect(down.summary).toBe("Side B 2 UP thru 7");
    expect(down.margin).toBe(-2);
    expect(computeMatchState(singles(card(4, {}, 0), card(4, {}, 0))).pairings[0].summary).toBe("Not started");
  });

  it("is halved after 18 all square", () => {
    const p = computeMatchState(singles(card(4, { 1: 3 }), card(4, { 18: 3 }))).pairings[0];
    expect(p.winnerSide).toBeNull();
    expect(p.closedOut).toBe(false);
    expect(p.summary).toBe("Halved");
  });

  it("is won 1 UP on the last hole", () => {
    const p = computeMatchState(singles(card(4, { 18: 3 }), card(4))).pairings[0];
    expect(p.winnerSide).toBe(0);
    expect(p.summary).toBe("Side A wins 1 UP");
  });

  it("is won 2 UP when the lead grows on the last hole", () => {
    const p = computeMatchState(singles(card(4, { 1: 3, 18: 3 }), card(4))).pairings[0];
    expect(p.summary).toBe("Side A wins 2 UP");
  });

  it("uses net scores", () => {
    // b gets a stroke on hole 3 (index 2) and makes 4 to a's 3: net halve.
    const strokes = { a: Array(18).fill(0), b: Array(18).fill(0) };
    strokes.b[2] = 1;
    const input = makeInput({
      format: "SINGLES_MATCH",
      players: [["a", 0], ["b", 1]],
      gross: { a: card(4, { 3: 3 }), b: card(4) },
      strokes,
    });
    const state = computeMatchState(input);
    expect(state.net.b[2]).toBe(3);
    expect(state.pairings[0].holeWinners[2]).toBeNull();
    expect(state.pairings[0].summary).toBe("Halved");
    // Same scores gross: a wins 1 UP.
    expect(computeMatchState({ ...input, scoring: "GROSS" }).pairings[0].summary).toBe("Side A wins 1 UP");
  });
});

describe("four-ball", () => {
  const players: [string, number][] = [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]];

  it("plays the best ball of each side", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players,
      gross: { a1: card(5, { 1: 3 }), a2: card(4, { 1: 6 }), b1: card(4), b2: card(6, { 2: 3 }) },
    });
    const p = computeMatchState(input).pairings[0];
    expect(p.holeWinners[0]).toBe(0); // a1's 3 beats b1's 4
    expect(p.holeWinners[1]).toBe(1); // b2's 3 beats a2's 4
    expect(p.holeWinners[2]).toBeNull();
    expect(p.summary).toBe("Halved");
  });

  it("waits for every player before a hole counts", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players,
      gross: { a1: card(4, { 5: null }), a2: card(4, { 5: 3 }), b1: card(4), b2: card(4) },
    });
    const state = computeMatchState(input);
    expect(state.finished).toBe(false);
    expect(state.currentHole).toBe(5);
    expect(state.holesCompleted).toBe(4);
    const p = state.pairings[0];
    expect(p.holeWinners[4]).toBeUndefined();
    expect(p.holesCompleted).toBe(17);
    expect(p.winnerSide).toBeUndefined();
    expect(p.summary).toBe("All square thru 17");

    // Once a1 enters a 6, a2's 3 is the side's ball and wins the hole.
    input.gross.a1 = card(4, { 5: 6 });
    const done = computeMatchState(input);
    expect(done.finished).toBe(true);
    expect(done.currentHole).toBeNull();
    expect(done.pairings[0].holeWinners[4]).toBe(0);
    expect(done.pairings[0].summary).toBe("Side A wins 1 UP");
  });

  it("plays stroke play on the side's best ball per hole", () => {
    const input = makeInput({
      format: "FOURBALL_STROKE",
      players,
      gross: { a1: card(4, { 1: 3 }), a2: card(5, { 2: 3 }), b1: card(4), b2: card(4) },
    });
    const p = computeMatchState(input).pairings[0];
    expect(p.margin).toBe(2);
    expect(p.summary).toBe("Side A wins by 2");
  });
});

describe("stroke play", () => {
  it("leads by cumulative strokes", () => {
    const p = computeMatchState(singles(card(4, { 1: 3, 2: 3, 3: 3 }, 12), card(4, {}, 12), "SINGLES_STROKE")).pairings[0];
    expect(p.kind).toBe("STROKE");
    expect(p.margin).toBe(3);
    expect(p.summary).toBe("Side A by 3 thru 12");
    expect(p.winnerSide).toBeUndefined();
    expect(p.closedOut).toBe(false);
  });

  it("is never closed out early, even 10 strokes behind", () => {
    const p = computeMatchState(singles(card(4, {}, 17), card(9, {}, 17), "SINGLES_STROKE")).pairings[0];
    expect(p.summary).toBe("Side A by 85 thru 17");
    expect(p.winnerSide).toBeUndefined();
  });

  it("reports ties", () => {
    expect(computeMatchState(singles(card(4, { 1: 3 }, 12), card(4, { 2: 3 }, 12), "SINGLES_STROKE")).pairings[0].summary).toBe("Tied thru 12");
  });

  it("ties on net totals even when gross differs", () => {
    const strokes = { a: Array(18).fill(0), b: Array(18).fill(0) };
    strokes.b[0] = 1;
    strokes.b[1] = 1;
    const input = makeInput({
      format: "SINGLES_STROKE",
      players: [["a", 0], ["b", 1]],
      gross: { a: card(4), b: card(4, { 1: 5, 2: 5 }) },
      strokes,
    });
    const p = computeMatchState(input).pairings[0];
    expect(p.winnerSide).toBeNull();
    expect(p.summary).toBe("Tied");
    expect(p.margin).toBe(0);
  });

  it("has a winner after 18", () => {
    const p = computeMatchState(singles(card(5), card(4, { 7: 6, 9: 6, 10: 7 }), "SINGLES_STROKE")).pairings[0];
    // b: 72 + 2 + 2 + 3 = 79 against 90
    expect(p.winnerSide).toBe(1);
    expect(p.summary).toBe("Side B wins by 11");
  });
});

describe("threesome", () => {
  it("plays three separate pairings", () => {
    const input = makeInput({
      format: "THREESOME_MATCH",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3, 2: 3 }), b: card(4, { 1: 3 }), c: card(4, { 3: 3 }) },
    });
    const state = computeMatchState(input);
    expect(state.pairings.map((p) => p.sides)).toEqual([[0, 1], [0, 2], [1, 2]]);
    expect(state.pairings.map((p) => p.summary)).toEqual(["Side A wins 1 UP", "Side A wins 1 UP", "Halved"]);
  });

  it("scores a pairing without waiting for the third player", () => {
    const input = makeInput({
      format: "THREESOME_STROKE",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3 }, 3), b: card(4, {}, 3), c: card(4, {}, 1) },
    });
    const state = computeMatchState(input);
    expect(state.currentHole).toBe(2);
    expect(state.pairings[0].summary).toBe("Side A by 1 thru 3");
    expect(state.pairings[1].summary).toBe("Side A by 1 thru 1");
    expect(state.pairings[2].summary).toBe("Tied thru 1");
  });
});

describe("nine point", () => {
  it("scores every tie pattern", () => {
    expect(ninePointHole([3, 4, 5])).toEqual([5, 3, 1]);
    expect(ninePointHole([5, 3, 4])).toEqual([1, 5, 3]);
    expect(ninePointHole([4, 4, 5])).toEqual([4, 4, 1]); // two best tie
    expect(ninePointHole([6, 4, 4])).toEqual([1, 4, 4]);
    expect(ninePointHole([3, 5, 5])).toEqual([5, 2, 2]); // two worst tie
    expect(ninePointHole([5, 3, 5])).toEqual([2, 5, 2]);
    expect(ninePointHole([4, 4, 4])).toEqual([3, 3, 3]);
  });

  it("totals points per hole and leaves incomplete holes empty", () => {
    const input = makeInput({
      format: "NINE_POINT",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3 }, 3), b: card(4, { 2: 5 }, 3), c: card(4, { 3: 3 }, 2) },
    });
    const state = computeMatchState(input);
    expect(state.pairings).toEqual([]);
    expect(state.ninePoint!.perHole.a.slice(0, 4)).toEqual([5, 4, null, null]);
    expect(state.ninePoint!.perHole.b.slice(0, 3)).toEqual([2, 1, null]);
    expect(state.ninePoint!.perHole.c.slice(0, 3)).toEqual([2, 4, null]);
    expect(state.ninePoint!.totals).toEqual({ a: 9, b: 3, c: 6 });
    expect(state.currentHole).toBe(3);
    // every complete hole hands out 9 points
    const all = computeMatchState(makeInput({
      format: "NINE_POINT",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3 }), b: card(5), c: card(4, { 4: 7 }) },
    }));
    const t = all.ninePoint!.totals;
    expect(t.a + t.b + t.c).toBe(18 * 9);
  });
});
