import type { Metadata } from "next";
import { headers } from "next/headers";
import { CommentWall } from "@/components/waitlist/CommentWall";
import { HowItWorks } from "@/components/waitlist/HowItWorks";
import { JoinAccountCard } from "@/components/waitlist/JoinAccountCard";
import { JoinCard } from "@/components/waitlist/JoinCard";
import { ScrollLink } from "@/components/waitlist/ScrollLink";
import { SpotCard } from "@/components/waitlist/SpotCard";
import { WaitlistFooter } from "@/components/waitlist/WaitlistFooter";
import { ErrorAlert } from "@/components/waitlist/JoinFields";
import { getCurrentUser } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { OAUTH_ERROR_TEXT } from "@/lib/oauth/flow";
import { enabledProviders, PROVIDER_LABEL } from "@/lib/oauth/providers";
import { publicOrigin, waitlistHome } from "@/lib/siteMode";
import { linkedProviders, listComments, waitlistCount, waitlistSpot } from "@/lib/waitlist";
import { METHOD_LABEL } from "@/lib/waitlistMath";

export const dynamic = "force-dynamic";

const TITLE = "RaKs Golfing | Join the waitlist";
const DESCRIPTION =
  "Book tee times where every round is a match against golfers at your level. Fair by handicap, live GPS scorecard and leaderboard. Join the waitlist.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "RaKs Golfing" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/** Show the live count once it's a number worth bragging about. */
const COUNT_FROM = 25;

type Params = Promise<{ oauth_error?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const { oauth_error } = await searchParams;
  const code = Array.isArray(oauth_error) ? oauth_error[0] : oauth_error;
  const oauthError = code && Object.hasOwn(OAUTH_ERROR_TEXT, code) ? OAUTH_ERROR_TEXT[code as keyof typeof OAUTH_ERROR_TEXT] : null;

  const home = waitlistHome();
  const signInHref = `/signin?next=${encodeURIComponent(home)}`;
  const user = await getCurrentUser();
  const [count, comments, spot, linked] = await Promise.all([
    waitlistCount(),
    listComments({ limit: 30, viewerId: user?.id }),
    user ? waitlistSpot(user.id) : null,
    user ? linkedProviders(user.id) : [],
  ]);
  const providers = enabledProviders().map((id) => ({ id, label: PROVIDER_LABEL[id] }));

  const linkedIds = new Set(linked.map((l) => l.provider));
  const connect = providers
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ label: p.label, href: `/api/auth/oauth/${p.id}/start?intent=link&next=${encodeURIComponent(home)}` }));

  const origin = publicOrigin(await headers());
  const showCount = count >= COUNT_FROM;
  const countText = `${count.toLocaleString("en-US")} golfers`;

  return (
    <div className="flex min-h-dvh flex-col">
      <main>
        <section className="relative isolate overflow-hidden bg-fairway-900 text-white">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(60rem 28rem at 85% -10%, rgba(31,122,61,0.75), transparent), radial-gradient(36rem 22rem at -5% 105%, rgba(242,97,29,0.2), transparent)",
            }}
          />
          <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <h1>
                <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-fairway-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 21V3l9 4-9 4" />
                    <circle cx="8" cy="21" r="0.5" fill="currentColor" />
                  </svg>
                  RaKs Golfing
                </span>
                <span className="mt-4 block text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  Every round is a <span className="text-flame">match</span>.
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-fairway-100">
                Book tee times and play golfers at your level, 1v1 or 2v2, from a $20 stake. Fair by handicap, scored live on your phone.
              </p>
              {showCount && (
                <p className="mt-4 text-sm font-medium text-fairway-100">
                  {spot ? `${countText} are on the waitlist` : `Join ${countText} on the waitlist`}
                </p>
              )}
              <ScrollLink
                to={spot ? "spot" : "join"}
                className="mt-6 inline-block rounded-xl bg-white px-6 py-4 font-semibold text-fairway-900 transition-colors hover:bg-fairway-100"
              >
                {spot ? "See your spot" : "Join the waitlist"}
              </ScrollLink>
            </div>

            <div className="space-y-3">
              {oauthError && <ErrorAlert>{oauthError}</ErrorAlert>}
              {spot && user ? (
                <SpotCard
                  position={spot.position}
                  total={spot.total}
                  referrals={spot.referrals}
                  inviteUrl={`${origin}${home === "/" ? "/" : "/waitlist"}?ref=${spot.referralCode}`}
                  signedUpWith={
                    spot.method === "email" || spot.method === "phone" ? METHOD_LABEL[spot.method].toLowerCase() : METHOD_LABEL[spot.method]
                  }
                  contact={user.email ?? (user.phone ? formatPhone(user.phone) : null)}
                  linked={linked.map((l) => ({ label: PROVIDER_LABEL[l.provider], username: l.username }))}
                  connect={connect}
                />
              ) : user ? (
                <JoinAccountCard name={user.name} method={user.email ? "email" : "phone"} />
              ) : (
                <JoinCard providers={providers} home={home} />
              )}
            </div>
          </div>
        </section>

        <HowItWorks />
        <CommentWall comments={comments} signedIn={Boolean(user)} now={new Date()} />
      </main>

      <WaitlistFooter signInHref={signInHref} />
    </div>
  );
}
