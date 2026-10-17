import { describe, expect, it } from "vitest";
import { assertBalanced, compactLegs, settlementLegs } from "../ledger";

describe("assertBalanced", () => {
  it("accepts legs that sum to zero", () => {
    expect(() =>
      assertBalanced([
        { account: "EXTERNAL", amountCents: -2000 },
        { account: "HELD", userId: "u1", amountCents: 2000 },
      ]),
    ).not.toThrow();
  });

  it("rejects unbalanced, fractional, zero and one-sided transactions", () => {
    expect(() => assertBalanced([{ account: "EXTERNAL", amountCents: -2000 }, { account: "HELD", userId: "u1", amountCents: 1999 }])).toThrow(/off by -1/);
    expect(() => assertBalanced([{ account: "EXTERNAL", amountCents: -0.5 }, { account: "HELD", userId: "u1", amountCents: 0.5 }])).toThrow(/whole/);
    expect(() => assertBalanced([{ account: "EXTERNAL", amountCents: 0 }, { account: "HELD", userId: "u1", amountCents: 0 }])).toThrow(/non-zero/);
    expect(() => assertBalanced([{ account: "EXTERNAL", amountCents: 0 }])).toThrow(/two entries/);
  });

  it("needs a user on wallet and held entries", () => {
    expect(() => assertBalanced([{ account: "EXTERNAL", amountCents: -100 }, { account: "WALLET", amountCents: 100 }])).toThrow(/need a user/);
  });
});

describe("compactLegs", () => {
  it("merges the same account and user and drops zeros", () => {
    expect(
      compactLegs([
        { account: "HELD", userId: "a", amountCents: -2000 },
        { account: "WALLET", userId: "a", amountCents: 0 },
        { account: "HELD", userId: "a", amountCents: 500 },
        { account: "WALLET", userId: "b", amountCents: 1500 },
      ]),
    ).toEqual([
      { account: "HELD", userId: "a", amountCents: -1500 },
      { account: "WALLET", userId: "b", amountCents: 1500 },
    ]);
  });
});

describe("settlementLegs", () => {
  it("releases every hold and pays out held + result", () => {
    const legs = settlementLegs([
      { userId: "winner", heldCents: 2000, resultCents: 2000 },
      { userId: "loser", heldCents: 2000, resultCents: -2000 },
    ]);
    assertBalanced(legs);
    expect(legs).toEqual([
      { account: "HELD", userId: "winner", amountCents: -2000 },
      { account: "WALLET", userId: "winner", amountCents: 4000 },
      { account: "HELD", userId: "loser", amountCents: -2000 },
    ]);
  });

  it("balances a four-way fourball with a lost press", () => {
    // Side 1 pressed and lost: each pays double (2 x $20), each had $40 held.
    const legs = settlementLegs([
      { userId: "a1", heldCents: 2000, resultCents: 4000 },
      { userId: "a2", heldCents: 2000, resultCents: 4000 },
      { userId: "b1", heldCents: 4000, resultCents: -4000 },
      { userId: "b2", heldCents: 4000, resultCents: -4000 },
    ]);
    assertBalanced(legs);
    expect(legs.filter((l) => l.account === "WALLET").reduce((s, l) => s + l.amountCents, 0)).toBe(12000);
  });

  it("refuses results that don't sum to zero or that a hold can't cover", () => {
    expect(() => settlementLegs([{ userId: "a", heldCents: 2000, resultCents: 1 }, { userId: "b", heldCents: 2000, resultCents: 0 }])).toThrow(/sum to 1/);
    expect(() => settlementLegs([{ userId: "a", heldCents: 2000, resultCents: 3000 }, { userId: "b", heldCents: 2000, resultCents: -3000 }])).toThrow(/doesn't cover/);
  });

  it("returns no legs for a halved match where nothing moves but holds", () => {
    const legs = settlementLegs([
      { userId: "a", heldCents: 2000, resultCents: 0 },
      { userId: "b", heldCents: 2000, resultCents: 0 },
    ]);
    assertBalanced(legs);
    expect(legs).toHaveLength(4);
  });
});
