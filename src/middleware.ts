import { NextResponse, type NextRequest } from "next/server";
import { chromeFor, waitlistRoute } from "@/lib/siteMode";

const DAYS_30 = 30 * 86_400;

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const waitlistMode = process.env.SITE_MODE === "waitlist";

  // The layout reads this to decide how much app chrome to draw.
  const headers = new Headers(req.headers);
  headers.set("x-raks-chrome", chromeFor(pathname, waitlistMode));

  let res: NextResponse;
  const route = waitlistMode ? waitlistRoute(pathname) : ({ action: "allow" } as const);
  if (route.action === "rewrite") {
    const url = req.nextUrl.clone();
    url.pathname = route.to;
    res = NextResponse.rewrite(url, { request: { headers } });
  } else if (route.action === "redirect") {
    return NextResponse.redirect(new URL(route.to, req.url));
  } else if (route.action === "not-found") {
    return NextResponse.json({ error: "Not open yet.", code: "NOT_FOUND" }, { status: 404 });
  } else {
    res = NextResponse.next({ request: { headers } });
  }

  // Remember who sent this visitor (a friend's link, a campaign) until they join.
  const ref = searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
    res.cookies.set("raks_ref", ref.toUpperCase(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: DAYS_30 });
  }
  const source = searchParams.get("utm_source");
  if (source && !req.cookies.get("raks_utm")) {
    const utm = {
      source: source.slice(0, 100),
      medium: searchParams.get("utm_medium")?.slice(0, 100) ?? null,
      campaign: searchParams.get("utm_campaign")?.slice(0, 100) ?? null,
    };
    res.cookies.set("raks_utm", JSON.stringify(utm), { httpOnly: true, sameSite: "lax", path: "/", maxAge: DAYS_30 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)"],
};
