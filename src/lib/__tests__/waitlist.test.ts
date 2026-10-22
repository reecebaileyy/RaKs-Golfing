// Waitlist accounts, sign-in codes and the comment wall against a real database.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const schema = await vi.hoisted(async () => {
  const { useTestSchema } = await import("./pgTestDb");
  return useTestSchema("waitlist");
});

import { db } from "../db";
import { issueLoginCode, verifyLoginCode } from "../loginCodes";
import { joinWaitlist, listComments, postComment, setCommentHidden, waitlistCsv, waitlistSpot, waitlistStats } from "../waitlist";

afterAll(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});

beforeEach(async () => {
  await db.golfComment.deleteMany();
  await db.waitlistEntry.deleteMany();
  await db.oAuthAccount.deleteMany();
  await db.loginCode.deleteMany();
  await db.user.deleteMany();
});

const join = (extra: Partial<Parameters<typeof joinWaitlist>[0]> = {}) =>
  joinWaitlist({ method: "email", name: "Maya Torres", email: "Maya@Example.com", ...extra });

describe("joinWaitlist", () => {
  it("creates a passwordless account with its entry", async () => {
    const { userId, created } = await join({ zip: "92831-1234", roundsPerMonth: "2-4", utm: { source: "tiktok", campaign: "launch" } });
    expect(created).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { waitlist: true } });
    expect(user).toMatchObject({ email: "maya@example.com", phone: null, passwordHash: null, name: "Maya Torres" });
    expect(user.waitlist).toMatchObject({ method: "email", zip: "92831", roundsPerMonth: "2-4", utmSource: "tiktok", utmCampaign: "launch" });
    expect(user.waitlist?.referralCode).toMatch(/^[A-Z2-9]{7}$/);
  });

  it("requires an email or a phone, and the one picked", async () => {
    await expect(join({ email: "" })).rejects.toThrow("Add an email or a phone number");
    await expect(join({ method: "phone", email: "sam@example.com" })).rejects.toThrow("Enter your phone number.");
    await expect(join({ email: "nope" })).rejects.toThrow("That email doesn't look right.");
    await expect(join({ name: "M" })).rejects.toThrow("Enter your name.");
    const { userId } = await join({ method: "phone", email: null, phone: "(714) 555-1234" });
    expect(await db.user.findUnique({ where: { id: userId } })).toMatchObject({ phone: "+17145551234", email: null });
  });

  it("never signs into an existing account by its email or phone", async () => {
    await join({ phone: "714-555-1234" });
    await expect(join({ name: "Someone Else" })).rejects.toMatchObject({ status: 409, code: "EXISTS" });
    await expect(join({ method: "phone", email: null, phone: "+1 714 555 1234" })).rejects.toThrow("That phone number is already on the list");
  });

  it("attaches the social login, and refuses one that's already used", async () => {
    const social = { provider: "tiktok" as const, profile: { providerAccountId: "tt-1", username: "birdie", displayName: "Birdie Queen" } };
    const { userId } = await join({ method: "tiktok", email: null, phone: "7145550000", social });
    const accounts = await db.oAuthAccount.findMany({ where: { userId } });
    expect(accounts).toMatchObject([{ provider: "tiktok", providerAccountId: "tt-1", username: "birdie" }]);
    await expect(join({ method: "tiktok", email: "other@example.com", social })).rejects.toMatchObject({ code: "EXISTS" });
    // A social method without its profile (the cookie ran out) is refused.
    await expect(join({ method: "x", email: "x@example.com", social: null })).rejects.toMatchObject({ code: "SOCIAL_EXPIRED" });
    expect(await db.user.count()).toBe(1);
  });

  it("credits referrals and counts the spot in line", async () => {
    const first = await join();
    const spot = (await waitlistSpot(first.userId))!;
    expect(spot).toMatchObject({ position: 1, total: 1, referrals: 0, method: "email" });
    const second = await join({ email: "sam@example.com", name: "Sam Patel", referralCode: spot.referralCode.toLowerCase() });
    await join({ email: "alex@example.com", name: "Alex Kim", referralCode: "NOSUCH1" });
    expect(await waitlistSpot(first.userId)).toMatchObject({ referrals: 1, total: 3 });
    expect(await waitlistSpot(second.userId)).toMatchObject({ position: 2 });
  });

  it("adds a signed-in account once", async () => {
    const user = await db.user.create({ data: { name: "Reece Bailey", email: "reece@example.com", passwordHash: "x" } });
    await joinWaitlist({ method: "email", name: "" }, user.id);
    await joinWaitlist({ method: "email", name: "" }, user.id);
    expect(await db.waitlistEntry.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("login codes", () => {
  it("signs in once with the right code", async () => {
    const code = await issueLoginCode("maya@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(await verifyLoginCode("maya@example.com", code === "000000" ? "111111" : "000000")).toBe(false);
    expect(await verifyLoginCode("sam@example.com", code)).toBe(false);
    expect(await verifyLoginCode("maya@example.com", code)).toBe(true);
    expect(await verifyLoginCode("maya@example.com", code)).toBe(false);
  });

  it("locks a code after 5 wrong guesses and expires it", async () => {
    const t0 = new Date("2026-10-20T12:00:00Z");
    const code = await issueLoginCode("+17145551234", t0);
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect(await verifyLoginCode("+17145551234", wrong, t0)).toBe(false);
    expect(await verifyLoginCode("+17145551234", code, t0)).toBe(false);
    const later = new Date(t0.getTime() + 60_000);
    const fresh = await issueLoginCode("+17145551234", later);
    expect(await verifyLoginCode("+17145551234", fresh, new Date(later.getTime() + 11 * 60_000))).toBe(false);
  });

  it("limits how often codes are sent", async () => {
    const t0 = new Date("2026-10-20T12:00:00Z");
    await issueLoginCode("sam@example.com", t0);
    await expect(issueLoginCode("sam@example.com", new Date(t0.getTime() + 5_000))).rejects.toMatchObject({ status: 429 });
    for (let i = 1; i < 5; i++) await issueLoginCode("sam@example.com", new Date(t0.getTime() + i * 60_000));
    await expect(issueLoginCode("sam@example.com", new Date(t0.getTime() + 10 * 60_000))).rejects.toThrow("Too many codes");
  });
});

describe("comments", () => {
  it("posts, rate limits, hides and lists", async () => {
    const { userId } = await join();
    const t0 = new Date("2026-10-20T12:00:00Z");
    await expect(postComment(userId, "see www.spam.biz", t0)).rejects.toThrow("Links");
    for (let i = 0; i < 3; i++) await postComment(userId, `Take number ${i + 1}`, new Date(t0.getTime() + i * 1000));
    await expect(postComment(userId, "One more", new Date(t0.getTime() + 5000))).rejects.toMatchObject({ status: 429 });
    const wall = await listComments({ viewerId: userId });
    expect(wall.map((c) => c.body)).toEqual(["Take number 3", "Take number 2", "Take number 1"]);
    expect(wall[0]).toMatchObject({ author: "Maya T.", mine: true });
    await setCommentHidden(wall[0].id, true);
    expect(await listComments()).toHaveLength(2);
    expect(await listComments({ includeHidden: true })).toHaveLength(3);
    await expect(setCommentHidden("missing", true)).rejects.toMatchObject({ status: 404 });
  });
});

describe("dashboard data", () => {
  it("summarizes and exports", async () => {
    const maya = await join({ zip: "92831" });
    const code = (await waitlistSpot(maya.userId))!.referralCode;
    await join({ method: "phone", name: "Sam Patel", email: null, phone: "7145551234", referralCode: code });
    const stats = await waitlistStats();
    expect(stats).toMatchObject({ total: 2, today: 2, referred: 1, withEmail: 1, withPhone: 1, comments: 0 });
    const csv = await waitlistCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^joined_at,name,email,phone,signed_up_with/);
    expect(lines[2]).toContain("Sam Patel,,'+17145551234,phone");
    expect(lines[2]).toContain(",referral,");
    expect(lines[2]).toContain("Maya Torres");
  });
});
