import { NextResponse } from "next/server";
import { errorRedirect, finishOAuth } from "@/lib/oauth/flow";
import { isProviderId } from "@/lib/oauth/providers";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  if (!isProviderId(provider)) return NextResponse.redirect(new URL(errorRedirect("signin", "/", "unavailable"), url));
  const to = await finishOAuth(
    provider,
    { code: url.searchParams.get("code"), state: url.searchParams.get("state"), error: url.searchParams.get("error") },
    url.origin,
  );
  return NextResponse.redirect(new URL(to, url));
}
