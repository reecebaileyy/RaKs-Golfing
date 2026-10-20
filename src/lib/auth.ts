// Email + password accounts with a database session behind an httpOnly cookie.
// Kept dependency-free; swapping in Auth.js or passkeys later only touches this file.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "raks_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 32);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const key = await scrypt(password, salt, 32);
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session and sets the cookie. Call from a route handler or server action. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { id: tokenId(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call from server components and route handlers. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: tokenId(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: sends signed-out visitors to sign in and back. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export class AuthError extends Error {}

/** For route handlers: throws AuthError (401) when signed out. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in to continue.");
  return user;
}

export async function signUp(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) throw new AuthError("An account with that email already exists.");
  const user = await db.user.create({
    data: { email, name: input.name.trim(), passwordHash: await hashPassword(input.password) },
  });
  // Link earlier guest bookings made with the same email.
  await db.golfer.updateMany({ where: { email, userId: null }, data: { userId: user.id } });
  await startSession(user.id);
  return user;
}

export async function signIn(input: { email: string; password: string }) {
  const user = await db.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthError("That email and password don't match.");
  }
  await startSession(user.id);
  return user;
}
