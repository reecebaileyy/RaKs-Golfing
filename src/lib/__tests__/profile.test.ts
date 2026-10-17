import { describe, expect, it, vi } from "vitest";

vi.mock("../golf/handicap", () => ({ adjustedGrossScore: vi.fn(), handicapIndex: vi.fn(), scoreDifferential: vi.fn() }));
vi.mock("../db", () => ({ db: {} }));

import { chooseHandicap, isVerified } from "../profile";

const base = { ghinNumber: null, ghinIndex: null, ghinVerified: false, cardCount: 0, appIndex: null };

describe("chooseHandicap", () => {
  it("plays off the GHIN index once verified", () => {
    expect(chooseHandicap({ ...base, ghinNumber: "123456", ghinIndex: 8.4, ghinVerified: true, cardCount: 7, appIndex: 9.9 })).toEqual({ index: 8.4, source: "GHIN" });
  });
  it("uses the app index with 5 or more cards and no verified GHIN", () => {
    expect(chooseHandicap({ ...base, ghinNumber: "123456", ghinIndex: 4, cardCount: 5, appIndex: 11.2 })).toEqual({ index: 11.2, source: "APP" });
    expect(chooseHandicap({ ...base, cardCount: 6, appIndex: 14 })).toEqual({ index: 14, source: "APP" });
  });
  it("falls back to a reported GHIN index", () => {
    expect(chooseHandicap({ ...base, ghinNumber: "123456", ghinIndex: 4.2, cardCount: 2, appIndex: null })).toEqual({ index: 4.2, source: "GHIN" });
  });
  it("has no handicap without GHIN or enough cards", () => {
    expect(chooseHandicap({ ...base, cardCount: 4, appIndex: 10 })).toEqual({ index: null, source: "NONE" });
    expect(chooseHandicap({ ...base, ghinNumber: "123456" })).toEqual({ index: null, source: "NONE" });
  });
});

describe("isVerified", () => {
  it("needs a checked GHIN and at least one round", () => {
    expect(isVerified(true, 1)).toBe(true);
    expect(isVerified(true, 0)).toBe(false);
    expect(isVerified(false, 9)).toBe(false);
  });
});
