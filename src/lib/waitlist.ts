// The pre-launch waitlist. Joining creates a real account (no password) tied to the way the golfer
// signed up, so at launch they sign in with that same email, phone number or social login.
// Every account has an email or a phone number; a social login alone isn't enough.

import { randomInt } from "node:crypto";
import { db } from "./db";
import { AppError } from "./api";
import { normalizeEmail, normalizePhone } from "./contact";
import type { OAuthProfile, ProviderId } from "./oauth/providers";
import {
  checkComment,
  csvLine,
  normalizeZip,
  publicName,
  sourceOf,
  summarize,
  type JoinMethod,
  type RoundsPerMonth,
  type WaitlistStats,
} from "./waitlistMath";

export interface JoinInput {
  method: JoinMethod;
  name: string;
  email?: string | null;
  phone?: string | null;
  zip?: string | null;
  roundsPerMonth?: RoundsPerMonth | null;
  /** A friend's referral code, from their link. */
  referralCode?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  /** The social login that started this sign-up, when method is x, tiktok or instagram. */
  social?: { provider: ProviderId; profile: OAuthProfile } | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newReferralCode = () => Array.from({ length: 7 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const clip = (s: string | null | undefined, n = 100) => (s ? s.trim().slice(0, n) || null : null);

async function referrerId(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const entry = await db.waitlistEntry.findUnique({ where: { referralCode: code.trim().toUpperCase() }, select: { userId: true } });
  return entry?.userId ?? null;
}

/** The entry's fields. Referral codes are 7 characters from 32, so a clash is not a practical worry. */
async function entryData(input: JoinInput, userId?: string) {
  const referredById = await referrerId(input.referralCode);
  return {
    method: input.method,
    zip: normalizeZip(input.zip),
    roundsPerMonth: input.roundsPerMonth ?? null,
    referralCode: newReferralCode(),
    referredById: referredById && referredById !== userId ? referredById : null,
    utmSource: clip(input.utm?.source),
    utmMedium: clip(input.utm?.medium),
    utmCampaign: clip(input.utm?.campaign),
  };
}

/**
 * Puts a golfer on the list. Signed in (`userId` given): adds their existing account.
 * Otherwise creates the account, with the social login attached when there is one.
 * Returns the account id; the caller starts the session.
 */
export async function joinWaitlist(input: JoinInput, userId?: string): Promise<{ userId: string; created: boolean }> {
  if (userId) {
    const data = await entryData(input, userId);
    await db.waitlistEntry.upsert({ where: { userId }, create: { userId, ...data }, update: {} });
    return { userId, created: false };
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) throw new AppError("Enter your name.");
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.email?.trim() && !email) throw new AppError("That email doesn't look right.");
  if (input.phone?.trim() && !phone) throw new AppError("Enter a 10 digit US number, or start with + and the country code.");
  if (!email && !phone) throw new AppError("Add an email or a phone number so we can reach you at launch.");
  if (input.method === "email" && !email) throw new AppError("Enter your email.");
  if (input.method === "phone" && !phone) throw new AppError("Enter your phone number.");
  const social = input.method === "email" || input.method === "phone" ? null : input.social;
  if (input.method !== "email" && input.method !== "phone" && social?.provider !== input.method) {
    throw new AppError("Your social sign-in timed out. Start again.", 400, "SOCIAL_EXPIRED");
  }

  const taken = await db.user.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    select: { email: true },
  });
  if (taken) {
    const what = email && taken.email === email ? "email" : "phone number";
    throw new AppError(`That ${what} is already on the list. Sign in to see your spot.`, 409, "EXISTS");
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        name,
        email,
        phone,
        oauthAccounts: social
          ? {
              create: {
                provider: social.provider,
                providerAccountId: social.profile.providerAccountId,
                username: clip(social.profile.username),
                displayName: clip(social.profile.displayName),
                avatarUrl: clip(social.profile.avatarUrl, 500),
              },
            }
          : undefined,
        waitlist: { create: await entryData(input) },
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw new AppError("That sign-in is already on the list. Sign in to see your spot.", 409, "EXISTS");
    }
    throw err;
  }
  // Guest bookings made earlier with this email follow the new account.
  if (email) await db.golfer.updateMany({ where: { email, userId: null }, data: { userId: user.id } });
  return { userId: user.id, created: true };
}

export interface WaitlistSpot {
  position: number;
  total: number;
  referralCode: string;
  referrals: number;
  method: JoinMethod;
  joinedAt: Date;
}

/** Where a golfer stands on the list, or null if they haven't joined. */
export async function waitlistSpot(userId: string): Promise<WaitlistSpot | null> {
  const entry = await db.waitlistEntry.findUnique({ where: { userId }, include: { _count: { select: { referrals: true } } } });
  if (!entry) return null;
  const [ahead, total] = await Promise.all([
    db.waitlistEntry.count({ where: { createdAt: { lt: entry.createdAt } } }),
    db.waitlistEntry.count(),
  ]);
  return {
    position: ahead + 1,
    total,
    referralCode: entry.referralCode,
    referrals: entry._count.referrals,
    method: entry.method as JoinMethod,
    joinedAt: entry.createdAt,
  };
}

/** Logins tied to the account, for "connect another" buttons. */
export async function linkedProviders(userId: string): Promise<{ provider: ProviderId; username: string | null }[]> {
  const rows = await db.oAuthAccount.findMany({ where: { userId }, select: { provider: true, username: true, displayName: true } });
  return rows.map((r) => ({ provider: r.provider as ProviderId, username: r.username ?? r.displayName }));
}

export const waitlistCount = () => db.waitlistEntry.count();

export interface WallComment {
  id: string;
  body: string;
  author: string;
  createdAt: Date;
  hidden: boolean;
  mine: boolean;
}

/** The newest comments for the wall. Admins pass includeHidden to moderate. */
export async function listComments(opts: { limit?: number; includeHidden?: boolean; viewerId?: string | null } = {}): Promise<WallComment[]> {
  const rows = await db.golfComment.findMany({
    where: opts.includeHidden ? {} : { hidden: false },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 30,
    include: { user: { select: { name: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    author: publicName(c.user.name),
    createdAt: c.createdAt,
    hidden: c.hidden,
    mine: c.userId === opts.viewerId,
  }));
}

const COMMENT_LIMITS = [
  { windowMs: 10 * 60_000, max: 3, message: "Easy, tiger. Give it a few minutes before posting again." },
  { windowMs: 24 * 3_600_000, max: 10, message: "That's plenty for today. Come back tomorrow." },
];

export async function postComment(userId: string, body: string, now = new Date()) {
  const checked = checkComment(body);
  if (!checked.ok) throw new AppError(checked.reason);
  for (const limit of COMMENT_LIMITS) {
    const recent = await db.golfComment.count({ where: { userId, createdAt: { gt: new Date(now.getTime() - limit.windowMs) } } });
    if (recent >= limit.max) throw new AppError(limit.message, 429, "RATE_LIMITED");
  }
  return db.golfComment.create({ data: { userId, body: checked.body, createdAt: now } });
}

export async function setCommentHidden(id: string, hidden: boolean) {
  const { count } = await db.golfComment.updateMany({ where: { id }, data: { hidden } });
  if (count === 0) throw new AppError("We couldn't find that comment.", 404, "NOT_FOUND");
}

const STATS_TZ = () => process.env.WAITLIST_TIME_ZONE || "America/Los_Angeles";

async function entryRows() {
  return db.waitlistEntry.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, phone: true, createdAt: true, oauthAccounts: { select: { provider: true, username: true } } } } },
  });
}

export async function waitlistStats(now = new Date(), days = 30): Promise<WaitlistStats & { comments: number; hiddenComments: number; timeZone: string }> {
  const [rows, comments, hiddenComments] = await Promise.all([
    entryRows(),
    db.golfComment.count({ where: { hidden: false } }),
    db.golfComment.count({ where: { hidden: true } }),
  ]);
  const timeZone = STATS_TZ();
  const stats = summarize(
    rows.map((r) => ({ ...r, hasEmail: Boolean(r.user.email), hasPhone: Boolean(r.user.phone) })),
    { now, timeZone, days },
  );
  return { ...stats, comments, hiddenComments, timeZone };
}

/** Every sign-up as CSV, oldest first, for a spreadsheet or an email tool. */
export async function waitlistCsv(): Promise<string> {
  const rows = await entryRows();
  const codeToName = new Map(rows.map((r) => [r.userId, r.user.name]));
  const lines = [
    csvLine(["joined_at", "name", "email", "phone", "signed_up_with", "social_handles", "zip", "rounds_per_month", "source", "utm_medium", "utm_campaign", "referred_by", "referral_code"]),
    ...rows.map((r) =>
      csvLine([
        r.createdAt.toISOString(),
        r.user.name,
        r.user.email,
        r.user.phone,
        r.method,
        r.user.oauthAccounts.map((a) => `${a.provider}:${a.username ?? ""}`).join(" "),
        r.zip,
        r.roundsPerMonth,
        sourceOf(r),
        r.utmMedium,
        r.utmCampaign,
        r.referredById ? codeToName.get(r.referredById) ?? "" : "",
        r.referralCode,
      ]),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
