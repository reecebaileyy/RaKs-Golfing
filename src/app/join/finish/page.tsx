import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinishForm } from "@/components/waitlist/FinishForm";
import { PROVIDER_LABEL } from "@/lib/oauth/providers";
import { readPendingSocial } from "@/lib/oauth/flow";
import { waitlistHome } from "@/lib/siteMode";

export const metadata: Metadata = { title: "Finish joining | RaKs Golfing", robots: { index: false } };

export default async function Page() {
  // The social sign-in waits in a cookie for 20 minutes; without it there's nothing to finish.
  const pending = await readPendingSocial();
  if (!pending) redirect(waitlistHome());

  const { provider, profile } = pending;
  const label = PROVIDER_LABEL[provider];
  const who = profile.username ? `@${profile.username}` : profile.displayName;
  const avatar = profile.avatarUrl?.startsWith("https://") ? profile.avatarUrl : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {avatar ? (
          // Provider avatars come from many hosts, so a plain img beats configuring next/image for each.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={48}
            height={48}
            referrerPolicy="no-referrer"
            className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fairway-100 text-lg font-bold text-fairway-900 dark:bg-fairway-900 dark:text-fairway-100"
            aria-hidden="true"
          >
            {label[0]}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted">Connected with {label}</p>
          <h1 className="break-words text-2xl font-bold">{who ? `Almost in, ${who}` : "Almost in"}</h1>
        </div>
      </div>
      <p className="text-muted">Add an email or phone number so we can reach you at launch. You&apos;ll still sign in with {label}.</p>
      <FinishForm provider={provider} defaultName={profile.displayName ?? profile.username ?? ""} home={waitlistHome()} />
    </div>
  );
}
