// SITE_MODE=waitlist turns the site into the pre-launch landing page: "/" shows the waitlist and
// the rest of the app is closed. Without it the full app runs and the waitlist lives at /waitlist.

export const isWaitlistMode = () => process.env.SITE_MODE === "waitlist";

/** Where the waitlist page lives for links and redirects. */
export const waitlistHome = () => (isWaitlistMode() ? "/" : "/waitlist");

/** Paths that stay open in waitlist mode. */
const OPEN = [/^\/waitlist(\/|$)/, /^\/join(\/|$)/, /^\/signin(\/|$)/, /^\/admin(\/|$)/, /^\/privacy(\/|$)/, /^\/terms(\/|$)/, /^\/api\/(auth|waitlist|admin)\//];

export type Route = { action: "rewrite"; to: string } | { action: "allow" } | { action: "redirect"; to: string } | { action: "not-found" };

/** What waitlist mode does with a request path. Pure, so it's unit tested. */
export function waitlistRoute(pathname: string): Route {
  if (pathname === "/") return { action: "rewrite", to: "/waitlist" };
  if (OPEN.some((re) => re.test(pathname))) return { action: "allow" };
  return pathname.startsWith("/api/") ? { action: "not-found" } : { action: "redirect", to: "/" };
}

/** How much of the app's header and tab bar a page gets: all, a plain header, or none (the landing page draws its own). */
export type Chrome = "full" | "minimal" | "none";

export function chromeFor(pathname: string, waitlistMode: boolean): Chrome {
  if (/^\/waitlist(\/|$)/.test(pathname) || (waitlistMode && pathname === "/")) return "none";
  if (waitlistMode || /^\/join(\/|$)/.test(pathname)) return "minimal";
  return "full";
}

/** Same-site paths only, so redirect targets can't bounce people to another site. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/** The site's public address for share links: APP_URL when set, else the request's own host. */
export function publicOrigin(h: Headers): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
