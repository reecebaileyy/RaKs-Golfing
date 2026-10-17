import { describe, expect, it } from "vitest";
import { priceBooking, PROTECTION_PER_PLAYER_CENTS } from "../pricing";

const base = { greenFeeCents: 5000, convenienceFeeCents: 299, taxRateBps: 775, taxIncluded: false, withProtection: false };

describe("priceBooking", () => {
  it("charges only fees online for pay-at-course rates", () => {
    const p = priceBooking({ ...base, players: 2, paymentMode: "PAY_AT_COURSE" });
    expect(p.greenFeeTotalCents).toBe(10000);
    expect(p.convenienceFeeCents).toBe(598);
    expect(p.taxCents).toBe(775);
    expect(p.dueOnlineCents).toBe(598);
    expect(p.dueAtCourseCents).toBe(10775);
    expect(p.totalCents).toBe(11373);
  });

  it("charges everything online for prepaid rates", () => {
    const p = priceBooking({ ...base, players: 4, paymentMode: "PREPAID", withProtection: true });
    expect(p.protectionCents).toBe(PROTECTION_PER_PLAYER_CENTS * 4);
    expect(p.dueAtCourseCents).toBe(0);
    expect(p.dueOnlineCents).toBe(p.totalCents);
  });

  it("ignores protection on pay-at-course rates", () => {
    const p = priceBooking({ ...base, players: 1, paymentMode: "PAY_AT_COURSE", withProtection: true });
    expect(p.protectionCents).toBe(0);
  });

  it("skips tax when the course includes it", () => {
    const p = priceBooking({ ...base, players: 1, paymentMode: "PREPAID", taxIncluded: true });
    expect(p.taxCents).toBe(0);
  });

  it("rejects bad player counts", () => {
    expect(() => priceBooking({ ...base, players: 0, paymentMode: "PREPAID" })).toThrow();
    expect(() => priceBooking({ ...base, players: 5, paymentMode: "PREPAID" })).toThrow();
  });
});
