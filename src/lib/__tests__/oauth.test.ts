import { afterEach, describe, expect, it, vi } from "vitest";
import { seal, unseal } from "../signedCookie";
import { authorizeUrl, callbackUrl, enabledProviders, fetchProfile, newPkce } from "../oauth/providers";
import { allow } from "../rateLimit";
import { createHash } from "node:crypto";

afterEach(() => vi.unstubAllEnvs());

describe("sealed cookies", () => {
  it("round-trips and rejects tampering or expiry", () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(40));
    const sealed = seal({ provider: "x", id: "123" }, 60);
    expect(unseal(sealed)).toEqual({ provider: "x", id: "123" });
    const [payload, mac] = sealed.split(".");
    const forged = Buffer.from(JSON.stringify({ v: { provider: "x", id: "999" }, exp: Date.now() + 60_000 })).toString("base64url");
    expect(unseal(`${forged}.${mac}`)).toBeNull();
    expect(unseal(`${payload}.${mac}x`)).toBeNull();
    expect(unseal(seal({ a: 1 }, -1))).toBeNull();
    expect(unseal(undefined)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "y".repeat(40));
    expect(unseal(sealed)).toBeNull();
  });

  it("refuses to sign without a secret in production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OAUTH_MOCK", "");
    expect(() => seal({}, 60)).toThrow(/AUTH_SECRET/);
  });
});

describe("providers", () => {
  it("are on only when their keys are set", () => {
    vi.stubEnv("OAUTH_MOCK", "");
    for (const k of ["X_CLIENT_ID", "X_CLIENT_SECRET", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"]) vi.stubEnv(k, "");
    expect(enabledProviders()).toEqual([]);
    vi.stubEnv("TIKTOK_CLIENT_KEY", "tk");
    expect(enabledProviders()).toEqual([]);
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "ts");
    expect(enabledProviders()).toEqual(["tiktok"]);
    vi.stubEnv("OAUTH_MOCK", "1");
    expect(enabledProviders()).toEqual(["x", "tiktok", "instagram"]);
  });

  it("builds each provider's authorize URL with our callback", () => {
    vi.stubEnv("OAUTH_MOCK", "");
    vi.stubEnv("APP_URL", "https://raks.golf/");
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("TIKTOK_CLIENT_KEY", "tkey");
    vi.stubEnv("INSTAGRAM_CLIENT_ID", "igid");
    const p = { origin: "http://internal:3000", state: "st", codeChallenge: "ch" };
    const x = new URL(authorizeUrl("x", p));
    expect(x.origin + x.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(Object.fromEntries(x.searchParams)).toMatchObject({
      client_id: "xid",
      redirect_uri: "https://raks.golf/api/auth/oauth/x/callback",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
    const tt = new URL(authorizeUrl("tiktok", p));
    expect(tt.searchParams.get("client_key")).toBe("tkey");
    expect(tt.searchParams.get("scope")).toBe("user.info.basic");
    const ig = new URL(authorizeUrl("instagram", p));
    expect(ig.searchParams.get("scope")).toBe("instagram_business_basic");
    expect(callbackUrl("instagram", "http://localhost:3000")).toBe("https://raks.golf/api/auth/oauth/instagram/callback");
  });

  it("makes S256 PKCE pairs", () => {
    const { verifier, challenge } = newPkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("mock mode sends people to the stand-in page and reads the handle back", async () => {
    vi.stubEnv("OAUTH_MOCK", "1");
    vi.stubEnv("APP_URL", "");
    expect(authorizeUrl("tiktok", { origin: "http://localhost:3000", state: "s", codeChallenge: "c" })).toMatch(/^\/api\/auth\/mock-oauth\?provider=tiktok&state=s&redirect_uri=/);
    expect(await fetchProfile("tiktok", { origin: "", code: "Birdie_Queen!", codeVerifier: "" })).toEqual({
      providerAccountId: "mock-tiktok-birdie_queen",
      username: "birdie_queen",
      displayName: "birdie_queen",
    });
  });

  it("reads X's profile from its API", async () => {
    vi.stubEnv("OAUTH_MOCK", "");
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xsecret");
    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(
        JSON.stringify(url.includes("token") ? { access_token: "tok" } : { data: { id: "42", name: "Reece", username: "reece", profile_image_url: "https://img" } }),
      );
    });
    const profile = await fetchProfile("x", { origin: "http://localhost:3000", code: "c0de", codeVerifier: "ver" });
    vi.unstubAllGlobals();
    expect(profile).toEqual({ providerAccountId: "42", username: "reece", displayName: "Reece", avatarUrl: "https://img" });
    const [tokenUrl, tokenInit] = calls[0];
    expect(tokenUrl).toBe("https://api.x.com/2/oauth2/token");
    expect((tokenInit?.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("xid:xsecret").toString("base64")}`);
    expect(String(tokenInit?.body)).toContain("code_verifier=ver");
    expect((calls[1][1]?.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });
});

describe("rate limit", () => {
  it("allows max hits per window", () => {
    const key = `t-${Math.random()}`;
    expect([1, 2, 3].map(() => allow(key, 2, 1000, 5000))).toEqual([true, true, false]);
    expect(allow(key, 2, 1000, 6001)).toBe(true);
  });
});
