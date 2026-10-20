// Small JSON cookies signed with AUTH_SECRET, for state that must come back unchanged
// (the OAuth round trip, and a social profile waiting for an email or phone number).

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production" && process.env.OAUTH_MOCK !== "1") {
    throw new Error("Set AUTH_SECRET (32+ random characters) to use social sign-in.");
  }
  return "dev-only-secret-do-not-use-in-production";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function seal(value: object, maxAgeSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ v: value, exp: Date.now() + maxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function unseal<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { v, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { v: T; exp: number };
    return exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export async function setSealed(name: string, value: object, maxAgeSeconds: number) {
  (await cookies()).set(name, seal(value, maxAgeSeconds), {
    httpOnly: true,
    // Lax so the cookie comes back on the provider's redirect to our callback.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function readSealed<T>(name: string): Promise<T | null> {
  return unseal<T>((await cookies()).get(name)?.value);
}

export async function clearCookie(name: string) {
  (await cookies()).delete(name);
}
