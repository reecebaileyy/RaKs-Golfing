import { describe, expect, it } from "vitest";
import { formatTeeTime, zonedDayRange, zonedTime } from "../time";

describe("time zones", () => {
  it("converts Pacific wall-clock time to UTC across DST", () => {
    expect(zonedTime("2026-07-01", 7, 30, "America/Los_Angeles").toISOString()).toBe("2026-07-01T14:30:00.000Z");
    expect(zonedTime("2026-12-01", 7, 30, "America/Los_Angeles").toISOString()).toBe("2026-12-01T15:30:00.000Z");
  });

  it("spans the 25 hour day when clocks fall back", () => {
    const { start, end } = zonedDayRange("2026-11-01", "America/Los_Angeles");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it("formats in the course's zone", () => {
    expect(formatTeeTime(new Date("2026-07-01T14:30:00Z"), "America/Los_Angeles")).toBe("7:30 AM");
  });
});
