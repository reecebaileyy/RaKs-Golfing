// One-time sign-in codes for accounts made with an email or phone number and no password.
// Codes are 6 digits, stored hashed, good for 10 minutes and 5 guesses, and used once.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { AppError } from "./api";

export const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
const RESEND_SECONDS = 30;

const hashCode = (target: string, code: string) => createHash("sha256").update(`${target}:${code}`).digest("hex");

/** Makes a new code for a normalized email or E.164 phone. The caller sends it. */
export async function issueLoginCode(target: string, now = new Date()): Promise<string> {
  const recent = await db.loginCode.findMany({
    where: { target, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= MAX_PER_HOUR) throw new AppError("Too many codes for that sign-in. Try again in an hour.", 429, "RATE_LIMITED");
  if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < RESEND_SECONDS * 1000) {
    throw new AppError("We just sent a code. Give it a few seconds before asking for another.", 429, "RATE_LIMITED");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.create({
    data: { target, codeHash: hashCode(target, code), expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000), createdAt: now },
  });
  return code;
}

/** True when the code matches the newest live code for the target; that code is then used up. */
export async function verifyLoginCode(target: string, code: string, now = new Date()): Promise<boolean> {
  const live = await db.loginCode.findFirst({
    where: { target, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!live || live.attempts >= MAX_ATTEMPTS) return false;
  const given = Buffer.from(hashCode(target, code.replace(/\D/g, "")), "hex");
  const ok = timingSafeEqual(given, Buffer.from(live.codeHash, "hex"));
  // Only the request that flips consumedAt wins, so a code can't be used twice in a race.
  const { count } = await db.loginCode.updateMany({
    where: { id: live.id, consumedAt: null },
    data: ok ? { consumedAt: now } : { attempts: { increment: 1 } },
  });
  return ok && count === 1;
}
