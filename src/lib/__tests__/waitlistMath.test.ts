import { describe, expect, it } from "vitest";
import { checkComment, csvCell, csvLine, normalizeZip, publicName, sourceOf, summarize, type EntryRow } from "../waitlistMath";

describe("publicName", () => {
  it("shows first name and last initial", () => {
    expect(publicName("Maya Torres")).toBe("Maya T.");
    expect(publicName("  jordan  van der lee ")).toBe("jordan L.");
    expect(publicName("Sam")).toBe("Sam");
    expect(publicName("   ")).toBe("A golfer");
  });
});

describe("checkComment", () => {
  it("cleans whitespace", () => expect(checkComment("  Shot 79   at  Brea!\n\n")).toEqual({ ok: true, body: "Shot 79 at Brea!" }));

  it("rejects empty, long and linked comments", () => {
    expect(checkComment(" ").ok).toBe(false);
    expect(checkComment("x".repeat(281)).ok).toBe(false);
    expect(checkComment("x".repeat(280)).ok).toBe(true);
    for (const spam of ["visit https://spam.example", "go to www.cheap.biz", "buy at golfdeals.com now"]) {
      expect(checkComment(spam)).toEqual({ ok: false, reason: "Links aren't allowed on the wall." });
    }
  });

  it("allows golf talk with numbers and dots", () => {
    expect(checkComment("Hit 7 iron 165 on #3. Par 4.5 avg this year...").ok).toBe(true);
  });
});

describe("normalizeZip", () => {
  it("takes 5 digit ZIPs and cuts ZIP+4", () => {
    expect(normalizeZip("92831")).toBe("92831");
    expect(normalizeZip(" 92831-1234 ")).toBe("92831");
    expect(normalizeZip("9283")).toBeNull();
    expect(normalizeZip("ABCDE")).toBeNull();
    expect(normalizeZip(null)).toBeNull();
  });
});

describe("csv", () => {
  it("quotes and defuses formulas", () => {
    expect(csvCell('Say "hi", ok')).toBe('"Say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+17145551234")).toBe("'+17145551234");
    expect(csvCell(null)).toBe("");
    expect(csvLine(["a", 1, undefined, "b\nc"])).toBe('a,1,,"b\nc"');
  });
});

const row = (createdAt: string, extra: Partial<EntryRow> = {}): EntryRow => ({
  createdAt: new Date(createdAt),
  method: "email",
  zip: null,
  roundsPerMonth: null,
  utmSource: null,
  referredById: null,
  hasEmail: true,
  hasPhone: false,
  ...extra,
});

describe("summarize", () => {
  // 2026-10-20 10:00 in Los Angeles.
  const now = new Date("2026-10-20T17:00:00Z");
  const rows = [
    row("2026-10-20T16:00:00Z", { method: "phone", hasEmail: false, hasPhone: true, zip: "92831", roundsPerMonth: "5+" }),
    // 11pm on the 19th in Los Angeles, though already the 20th in UTC.
    row("2026-10-20T06:00:00Z", { method: "x", utmSource: "TikTok", zip: "92831" }),
    row("2026-10-15T18:00:00Z", { referredById: "u1", zip: "92835", roundsPerMonth: "2-4" }),
    row("2026-09-01T18:00:00Z"),
  ];
  const s = summarize(rows, { now, timeZone: "America/Los_Angeles", days: 30 });

  it("counts totals by the local calendar day", () => {
    expect(s.total).toBe(4);
    expect(s.today).toBe(1);
    expect(s.last7).toBe(3);
    expect(s.referred).toBe(1);
    expect(s.withEmail).toBe(3);
    expect(s.withPhone).toBe(1);
  });

  it("breaks sign-ups down", () => {
    expect(s.byMethod).toEqual([
      { method: "email", count: 2 },
      { method: "phone", count: 1 },
      { method: "x", count: 1 },
    ]);
    expect(s.bySource).toEqual([
      { source: "direct", count: 2 },
      { source: "referral", count: 1 },
      { source: "tiktok", count: 1 },
    ]);
    expect(s.topZips).toEqual([
      { zip: "92831", count: 2 },
      { zip: "92835", count: 1 },
    ]);
    expect(s.byRounds[0]).toEqual({ rounds: "not given", count: 2 });
  });

  it("fills every day of the window, oldest first", () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily[0].date).toBe("2026-09-21");
    expect(s.daily.at(-1)).toEqual({ date: "2026-10-20", count: 1 });
    expect(s.daily.find((d) => d.date === "2026-10-19")?.count).toBe(1);
    expect(s.daily.reduce((a, d) => a + d.count, 0)).toBe(3);
  });

  it("names the source", () => {
    expect(sourceOf({ utmSource: "IG", referredById: "u" })).toBe("ig");
    expect(sourceOf({ utmSource: null, referredById: null })).toBe("direct");
  });
});
