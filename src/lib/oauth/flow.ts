// The social sign-in round trip: start -> provider -> callback. A known social account signs in;
// a new one waits in a signed cookie until the golfer adds the email or phone number every account needs.

import { randomBytes } from "node:crypto";
import { db } from "../db";
import { getCurrentUser, startSession } from "../auth";
import { safeNext, waitlistHome } from "../siteMode";
import { clearCookie, readSealed, setSealed } from "../signedCookie";
import { authorizeUrl, fetchProfile, newPkce, type OAuthProfile, type ProviderId } from "./providers";

export type Intent = "waitlist" | "signin" | "link";
export const INTENTS: Intent[] = ["waitlist", "signin", "link"];

const STATE_COOKIE = "raks_oauth";
export const PENDING_COOKIE = "raks_social";

interface StateCookie {
  provider: ProviderId;
  state: string;
  verifier: string;
  intent: Intent;
  next: string;
}

export interface PendingSocial {
  provider: ProviderId;
  profile: OAuthProfile;
  intent: Intent;
  next: string;
}

export type OAuthErrorCode = "cancelled" | "expired" | "failed" | "taken" | "unavailable";

export const OAUTH_ERROR_TEXT: Record<OAuthErrorCode, string> = {
  cancelled: "Sign-in was cancelled.",
  expired: "That sign-in took too long. Try again.",
  failed: "We couldn't reach that app to sign you in. Try again, or use your email or phone.",
  taken: "That social account is already tied to another RaKs account.",
  unavailable: "That sign-in option isn't set up yet.",
};

/** Where to send someone when the round trip fails, with the reason in the query. */
export function errorRedirect(intent: Intent, next: string, code: OAuthErrorCode): string {
  const base = intent === "waitlist" ? waitlistHome() : intent === "link" ? next : "/signin";
  return `${base}${base.includes("?") ? "&" : "?"}oauth_error=${code}`;
}

export async function beginOAuth(provider: ProviderId, opts: { intent: Intent; next?: string | null; origin: string }): Promise<string> {
  const state = randomBytes(16).toString("base64url");
  const { verifier, challenge } = newPkce();
  const next = safeNext(opts.next, opts.intent === "waitlist" ? waitlistHome() : "/");
  await setSealed(STATE_COOKIE, { provider, state, verifier, intent: opts.intent, next } satisfies StateCookie, 600);
  return authorizeUrl(provider, { origin: opts.origin, state, codeChallenge: challenge });
}

/** Handles the provider's redirect back. Returns where to send the browser next. */
export async function finishOAuth(
  provider: ProviderId,
  query: { code: string | null; state: string | null; error: string | null },
  origin: string,
): Promise<string> {
  const saved = await readSealed<StateCookie>(STATE_COOKIE);
  await clearCookie(STATE_COOKIE);
  if (!saved || saved.provider !== provider || !query.state || saved.state !== query.state) {
    return errorRedirect(saved?.intent ?? "signin", saved?.next ?? "/", "expired");
  }
  const { intent, next } = saved;
  if (query.error || !query.code) return errorRedirect(intent, next, "cancelled");

  let profile: OAuthProfile;
  try {
    profile = await fetchProfile(provider, { origin, code: query.code, codeVerifier: saved.verifier });
  } catch (err) {
    console.error(`[oauth] ${provider} profile failed`, err);
    return errorRedirect(intent, next, "failed");
  }

  const me = await getCurrentUser();
  const key = { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } };
  const existing = await db.oAuthAccount.findUnique({ where: key });
  const details = { username: profile.username ?? null, displayName: profile.displayName ?? null, avatarUrl: profile.avatarUrl ?? null };

  if (existing) {
    if (intent === "link" && me && existing.userId !== me.id) return errorRedirect(intent, next, "taken");
    await db.oAuthAccount.update({ where: key, data: details });
    if (me?.id !== existing.userId) await startSession(existing.userId);
    return next;
  }

  if (intent === "link") {
    if (!me) return `/signin?next=${encodeURIComponent(next)}`;
    await db.oAuthAccount.create({ data: { userId: me.id, provider, providerAccountId: profile.providerAccountId, ...details } });
    return next;
  }

  // New to us: every account needs an email or phone, so ask for one before creating it.
  await setSealed(PENDING_COOKIE, { provider, profile, intent, next } satisfies PendingSocial, 20 * 60);
  return "/join/finish";
}

export const readPendingSocial = () => readSealed<PendingSocial>(PENDING_COOKIE);
export const clearPendingSocial = () => clearCookie(PENDING_COOKIE);
