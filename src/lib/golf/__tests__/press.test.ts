import { describe, expect, it } from "vitest";
import { pressEligibility } from "../press";
import { computeMatchState } from "../scoring";
import type { MatchFormat, MatchScoringInput } from "../types";
import { card, makeInput } from "./helpers";

const singles = (format: MatchFormat, a: (number | null)[], b: (number | null)[], presses: MatchScoringInput["presses"] = []) =>
  makeInput({ format, players: [["a", 0], ["b", 1]], gross: { a, b }, presses });

const check = (input: MatchScoringInput, side: number, opponentSide: number) =>
  pressEligibility(input, computeMatchState(input), side, opponentSide);

describe("press eligibility, match play", () => {
  // a wins holes 1-4, halves to 15: closed out 4&3 with 16-18 to play.
  const closed = singles("SINGLES_MATCH", card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }, 15), card(4, {}, 15));

  it("lets the side that's closed out press any remaining hole", () => {
    expect(check(closed, 1, 0)).toEqual({ eligible: true, holes: [16, 17, 18] });
    const later = singles("SINGLES_MATCH", card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }, 17), card(4, {}, 17));
    expect(check(later, 1, 0)).toEqual({ eligible: true, holes: [18] });
  });

  it("never lets the winning side press", () => {
    expect(check(closed, 0, 1)).toMatchObject({ eligible: false, reason: "Only the side that's down can press", holes: [] });
  });

  it("lets the side that's down press 18 when the match is alive", () => {
    const alive = singles("SINGLES_MATCH", card(4, { 1: 3 }, 17), card(4, {}, 17));
    expect(check(alive, 1, 0)).toEqual({ eligible: true, holes: [18] });
  });

  it("has no press when all square going to 18", () => {
    const square = singles("SINGLES_MATCH", card(4, {}, 17), card(4, {}, 17));
    expect(check(square, 0, 1).eligible).toBe(false);
    expect(check(square, 1, 0).reason).toBe("Only the side that's down can press");
  });

  it("has no press while the match is alive before 18", () => {
    const early = singles("SINGLES_MATCH", card(4, { 1: 3 }, 10), card(4, {}, 10));
    expect(check(early, 1, 0)).toMatchObject({
      eligible: false,
      reason: "You can press once the match is closed out or on the last hole",
    });
    // Dormie is still alive.
    const dormie = singles("SINGLES_MATCH", card(4, { 1: 3, 2: 3, 3: 3 }, 15), card(4, {}, 15));
    expect(check(dormie, 1, 0).eligible).toBe(false);
  });

  it("allows one press per side per pairing", () => {
    const pressed = { ...closed, presses: [{ side: 1, opponentSide: 0, holeNumber: 16 }] };
    expect(check(pressed, 1, 0)).toMatchObject({ eligible: false, reason: "Already pressed" });
  });

  it("is over once every hole is played", () => {
    const done = singles("SINGLES_MATCH", card(4, { 1: 3 }), card(4));
    expect(check(done, 1, 0)).toMatchObject({ eligible: false, reason: "The match is over" });
  });

  it("works per pairing in a threesome", () => {
    // a beats b on holes 1-4 (closed out after 15); c and b level.
    const input = makeInput({
      format: "THREESOME_MATCH",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(4, { 1: 3, 2: 3, 3: 3, 4: 3 }, 15), b: card(4, {}, 15), c: card(4, {}, 15) },
    });
    expect(check(input, 1, 0)).toEqual({ eligible: true, holes: [16, 17, 18] });
    expect(check(input, 2, 0)).toEqual({ eligible: true, holes: [16, 17, 18] });
    expect(check(input, 1, 2).eligible).toBe(false); // all square
    expect(check(input, 1, 1).eligible).toBe(false);
    expect(check(input, 1, 3).reason).toBe("There's no match between those sides");
    // b's press against a doesn't use up b's press against c.
    const pressed = { ...input, presses: [{ side: 1, opponentSide: 0, holeNumber: 16 }] };
    expect(check(pressed, 1, 0).reason).toBe("Already pressed");
    expect(check(pressed, 2, 0).eligible).toBe(true);
  });

  it("counts four-ball holes only when all four have scored", () => {
    const input = makeInput({
      format: "FOURBALL_MATCH",
      players: [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]],
      gross: { a1: card(4, { 1: 3 }, 17), a2: card(4, {}, 17), b1: card(4, {}, 17), b2: card(4, {}, 17) },
    });
    input.gross.b2[17] = 4; // one player has already holed out on 18
    expect(check(input, 1, 0)).toEqual({ eligible: true, holes: [18] });
  });
});

describe("press eligibility, stroke play", () => {
  it("lets the side behind press only the last hole", () => {
    const thru17 = singles("SINGLES_STROKE", card(4, { 1: 3 }, 17), card(4, {}, 17));
    expect(check(thru17, 1, 0)).toEqual({ eligible: true, holes: [18] });
    expect(check(thru17, 0, 1).reason).toBe("Only the side that's down can press");
  });

  it("does not allow a press before the last hole, even far behind", () => {
    const thru12 = singles("SINGLES_STROKE", card(4, {}, 12), card(8, {}, 12));
    expect(check(thru12, 1, 0)).toMatchObject({ eligible: false, reason: "In stroke play you can only press the last hole" });
  });

  it("does not allow a press when tied", () => {
    const tied = singles("SINGLES_STROKE", card(4, {}, 17), card(4, {}, 17));
    expect(check(tied, 1, 0).eligible).toBe(false);
  });
});

describe("press eligibility, nine point", () => {
  it("never allows a press", () => {
    const input = makeInput({
      format: "NINE_POINT",
      players: [["a", 0], ["b", 1], ["c", 2]],
      gross: { a: card(3, {}, 17), b: card(5, {}, 17), c: card(5, {}, 17) },
      pointValueCents: 100,
    });
    expect(check(input, 1, 0)).toMatchObject({ eligible: false, reason: "There are no presses in the nine point game" });
  });
});
