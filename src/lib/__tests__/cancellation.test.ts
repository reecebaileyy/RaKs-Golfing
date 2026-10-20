import { describe, expect, it } from "vitest";
import { quoteCancellation } from "../cancellation";

const startsAt = new Date("2026-10-20T15:00:00Z");
const hoursBefore = (h: number) => new Date(startsAt.getTime() - h * 3_600_000);
const base = { startsAt, cancelWindowHours: 24, hasProtection: false, prepaidCourseCents: 8000 };

describe("quoteCancellation", () => {
  it("refunds prepaid green fees outside the course window", () => {
    expect(quoteCancellation({ ...base, now: hoursBefore(30) })).toMatchObject({ allowed: true, refundable: true, refundCents: 8000 });
  });

  it("refunds nothing inside the window without protection", () => {
    expect(quoteCancellation({ ...base, now: hoursBefore(5) })).toMatchObject({ allowed: true, refundable: false, refundCents: 0 });
  });

  it("protection moves the cutoff to one hour before", () => {
    expect(quoteCancellation({ ...base, hasProtection: true, now: hoursBefore(2) })).toMatchObject({ refundable: true, refundCents: 8000 });
    expect(quoteCancellation({ ...base, hasProtection: true, now: hoursBefore(0.5) })).toMatchObject({ refundable: false });
  });

  it("blocks cancelling after the tee time", () => {
    expect(quoteCancellation({ ...base, now: hoursBefore(-1) }).allowed).toBe(false);
  });
});
