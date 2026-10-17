import { describe, expect, it } from "vitest";
import { buildLiveView, nameSummary, scoresBody } from "../live";
import type { LoadedMatch } from "../matchData";

const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1, yards: 380 }));

function fakeMatch(overrides: Partial<LoadedMatch> = {}): LoadedMatch {
  const strokes = JSON.stringify(Array.from({ length: 18 }, (_, i) => (i < 6 ? 1 : 0)));
  return {
    code: "ABC123",
    format: "SINGLES_MATCH",
    scoring: "NET",
    status: "LIVE",
    stakeCents: 2000,
    pointValueCents: null,
    players: [
      { userId: "u1", side: 0, user: { name: "Reece Bailey" }, strokesReceived: null },
      { userId: "u2", side: 1, user: { name: "Maya Torres" }, strokesReceived: strokes },
    ],
    scores: [
      { userId: "u1", holeNumber: 1, strokes: 4 },
      { userId: "u2", holeNumber: 1, strokes: 5 },
      { userId: "u1", holeNumber: 2, strokes: 6 },
    ],
    presses: [],
    course: { name: "Fullerton Ridge", city: "Fullerton", holes },
    teeSet: {},
    teeTime: { startsAt: new Date("2026-10-17T15:00:00Z") },
    ...overrides,
  } as unknown as LoadedMatch;
}

describe("buildLiveView", () => {
  it("computes net from frozen strokes and counts only holes everyone has finished", () => {
    const v = buildLiveView(fakeMatch(), null);
    const maya = v.players.find((p) => p.userId === "u2")!;
    expect(maya.net[0]).toBe(4);
    expect(maya.grossTotal).toBe(5);
    expect(v.holesCompleted).toBe(1);
    expect(v.pairings).toBeNull();
    expect(v.sideNames).toEqual(["Reece", "Maya"]);
  });

  it("keeps gross as the score on gross matches", () => {
    const v = buildLiveView(fakeMatch({ scoring: "GROSS" }), null);
    expect(v.players[1].net[0]).toBe(5);
  });

  it("never leaks emails", () => {
    const m = fakeMatch();
    (m.players[0].user as unknown as Record<string, string>).email = "reece@example.com";
    expect(JSON.stringify(buildLiveView(m, null))).not.toContain("example.com");
  });

  it("swaps side labels for names in pairing summaries", () => {
    expect(nameSummary("Side A 2 UP thru 7", ["Reece & Maya", "Jordan"])).toBe("Reece & Maya 2 UP thru 7");
    expect(nameSummary("AS", ["x", "y"])).toBe("AS");
  });
});

describe("scoresBody", () => {
  it("limits strokes to 1..15 and holes to 1..18", () => {
    expect(scoresBody.safeParse({ holeNumber: 1, scores: [{ userId: "u", strokes: 4 }] }).success).toBe(true);
    expect(scoresBody.safeParse({ holeNumber: 1, scores: [{ userId: "u", strokes: 16 }] }).success).toBe(false);
    expect(scoresBody.safeParse({ holeNumber: 1, scores: [{ userId: "u", strokes: 0 }] }).success).toBe(false);
    expect(scoresBody.safeParse({ holeNumber: 19, scores: [{ userId: "u", strokes: 4 }] }).success).toBe(false);
  });
});
