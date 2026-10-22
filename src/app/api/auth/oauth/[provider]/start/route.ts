import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { beginOAuth, errorRedirect, INTENTS, type Intent } from "@/lib/oauth/flow";
import { isProviderId, providerEnabled } from "@/lib/oauth/providers";
import { safeNext } from "@/lib/siteMode";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const raw = url.searchParams.get("intent") ?? "signin";
  const intent: Intent = (INTENTS as string[]).includes(raw) ? (raw as Intent) : "signin";
  const next = url.searchParams.get("next");
  if (!isProviderId(provider) || !providerEnabled(provider)) {
    return NextResponse.redirect(new URL(errorRedirect(intent, safeNext(next, "/"), "unavailable"), url));
  }
  if (intent === "link" && !(await getCurrentUser())) {
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(safeNext(next, "/"))}`, url));
  }
  return NextResponse.redirect(new URL(await beginOAuth(provider, { intent, next, origin: url.origin }), url));
}
