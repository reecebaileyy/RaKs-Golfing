// A stand-in for the X, TikTok and Instagram consent screens, on only when OAUTH_MOCK=1.
// Lets the social sign-up be tried and tested before the real apps are approved.

import { NextResponse } from "next/server";
import { isProviderId, oauthMock, PROVIDER_LABEL } from "@/lib/oauth/providers";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  if (!oauthMock() || !isProviderId(provider)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only ever hand the code back to our own callback.
  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    return NextResponse.json({ error: "Bad redirect" }, { status: 400 });
  }
  if (target.pathname !== `/api/auth/oauth/${provider}/callback`) return NextResponse.json({ error: "Bad redirect" }, { status: 400 });
  const action = `${target.pathname}`;
  const label = PROVIDER_LABEL[provider];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test ${esc(label)} sign-in</title>
<style>body{font-family:system-ui,sans-serif;max-width:24rem;margin:3rem auto;padding:0 1rem;color:#14231a}
label,input,button{display:block;width:100%;box-sizing:border-box;font-size:1rem}input{padding:.75rem;margin:.25rem 0 1rem;border:1px solid #c9d3cc;border-radius:.75rem}
button{padding:.9rem;border:0;border-radius:.75rem;background:#17602f;color:#fff;font-weight:600}a{display:block;text-align:center;margin-top:1rem;color:#17602f}</style></head>
<body><p style="font-size:.85rem;color:#5b6b60">Test mode. This page stands in for ${esc(label)} until the real app keys are set.</p>
<h1>Sign in with ${esc(label)}</h1>
<form method="get" action="${esc(action)}"><input type="hidden" name="state" value="${esc(state)}">
<label for="code">${esc(label)} username</label><input id="code" name="code" required autocomplete="off" value="testgolfer">
<button type="submit">Authorize RaKs Golfing</button></form>
<a href="${esc(action)}?error=access_denied&amp;state=${encodeURIComponent(state)}">Cancel</a></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
