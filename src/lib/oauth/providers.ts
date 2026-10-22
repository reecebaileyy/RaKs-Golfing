// Social sign-in with X, TikTok and Instagram over plain OAuth 2.0 (authorization code flow).
// Each provider turns on when its keys are set. OAUTH_MOCK=1 swaps all three for a local
// stand-in consent page so the flow can be tried and tested without real apps.

import { createHash, randomBytes } from "node:crypto";

export const PROVIDER_IDS = ["x", "tiktok", "instagram"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABEL: Record<ProviderId, string> = { x: "X", tiktok: "TikTok", instagram: "Instagram" };

export interface OAuthProfile {
  providerAccountId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface Provider {
  keys: string[];
  authorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  profile(p: { code: string; redirectUri: string; codeVerifier: string }): Promise<OAuthProfile>;
}

const env = (name: string) => process.env[name] ?? "";

export const isProviderId = (id: string): id is ProviderId => (PROVIDER_IDS as readonly string[]).includes(id);
export const oauthMock = () => process.env.OAUTH_MOCK === "1";

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

const PROVIDERS: Record<ProviderId, Provider> = {
  // https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
  x: {
    keys: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    authorizeUrl: ({ clientId, redirectUri, state, codeChallenge }) =>
      `https://x.com/i/oauth2/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "users.read tweet.read",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      })}`,
    async profile({ code, redirectUri, codeVerifier }) {
      const basic = Buffer.from(`${env("X_CLIENT_ID")}:${env("X_CLIENT_SECRET")}`).toString("base64");
      const token = await json<{ access_token: string }>(
        await fetch("https://api.x.com/2/oauth2/token", {
          method: "POST",
          headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier }),
        }),
        "X token",
      );
      const me = await json<{ data: { id: string; name?: string; username?: string; profile_image_url?: string } }>(
        await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", {
          headers: { authorization: `Bearer ${token.access_token}` },
        }),
        "X profile",
      );
      return { providerAccountId: me.data.id, username: me.data.username, displayName: me.data.name, avatarUrl: me.data.profile_image_url };
    },
  },
  // https://developers.tiktok.com/doc/login-kit-web
  tiktok: {
    keys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
        client_key: clientId,
        response_type: "code",
        scope: "user.info.basic",
        redirect_uri: redirectUri,
        state,
      })}`,
    async profile({ code, redirectUri }) {
      const token = await json<{ access_token?: string; open_id?: string; error?: string }>(
        await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: env("TIKTOK_CLIENT_KEY"),
            client_secret: env("TIKTOK_CLIENT_SECRET"),
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        }),
        "TikTok token",
      );
      if (!token.access_token) throw new Error(`TikTok token failed: ${token.error ?? "no token"}`);
      const info = await json<{ data?: { user?: { open_id: string; display_name?: string; avatar_url?: string } } }>(
        await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name", {
          headers: { authorization: `Bearer ${token.access_token}` },
        }),
        "TikTok profile",
      );
      const user = info.data?.user;
      const id = user?.open_id ?? token.open_id;
      if (!id) throw new Error("TikTok profile had no open_id");
      return { providerAccountId: id, displayName: user?.display_name, avatarUrl: user?.avatar_url };
    },
  },
  // Instagram API with Instagram Login. Only professional (business or creator) accounts can sign in;
  // the Basic Display API that covered personal accounts was shut down in December 2024.
  // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
  instagram: {
    keys: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://www.instagram.com/oauth/authorize?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "instagram_business_basic",
        state,
      })}`,
    async profile({ code, redirectUri }) {
      type Token = { access_token: string; user_id?: string | number };
      const raw = await json<Token | { data: Token[] }>(
        await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env("INSTAGRAM_CLIENT_ID"),
            client_secret: env("INSTAGRAM_CLIENT_SECRET"),
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            // Instagram sometimes appends "#_" to the code in the redirect.
            code: code.replace(/#_$/, ""),
          }),
        }),
        "Instagram token",
      );
      const token = "data" in raw ? raw.data[0] : raw;
      const me = await json<{ user_id?: string; id?: string; username?: string }>(
        await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token.access_token)}`),
        "Instagram profile",
      );
      const id = me.user_id ?? (token.user_id !== undefined ? String(token.user_id) : me.id);
      if (!id) throw new Error("Instagram profile had no id");
      return { providerAccountId: id, username: me.username };
    },
  },
};

/** Providers people can pick right now: those with keys set, or all of them in mock mode. */
export function enabledProviders(): ProviderId[] {
  if (oauthMock()) return [...PROVIDER_IDS];
  return PROVIDER_IDS.filter((id) => PROVIDERS[id].keys.every((k) => env(k)));
}

export const providerEnabled = (id: ProviderId) => enabledProviders().includes(id);

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function callbackUrl(id: ProviderId, origin: string): string {
  // Behind a proxy the request origin can be internal; APP_URL pins the public address the app was registered with.
  return `${(process.env.APP_URL || origin).replace(/\/$/, "")}/api/auth/oauth/${id}/callback`;
}

export function authorizeUrl(id: ProviderId, p: { origin: string; state: string; codeChallenge: string }): string {
  const redirectUri = callbackUrl(id, p.origin);
  if (oauthMock()) {
    return `/api/auth/mock-oauth?${new URLSearchParams({ provider: id, state: p.state, redirect_uri: redirectUri })}`;
  }
  return PROVIDERS[id].authorizeUrl({ clientId: env(PROVIDERS[id].keys[0]), redirectUri, state: p.state, codeChallenge: p.codeChallenge });
}

/** Trades the code from the callback for the person's provider profile. */
export async function fetchProfile(id: ProviderId, p: { origin: string; code: string; codeVerifier: string }): Promise<OAuthProfile> {
  if (oauthMock()) {
    // The mock consent page puts the handle in the code: "mock:<handle>".
    const handle = p.code.replace(/^mock:/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30) || "golfer";
    return { providerAccountId: `mock-${id}-${handle}`, username: handle, displayName: handle };
  }
  return PROVIDERS[id].profile({ code: p.code, redirectUri: callbackUrl(id, p.origin), codeVerifier: p.codeVerifier });
}
