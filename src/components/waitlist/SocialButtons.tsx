import type { ProviderId } from "@/lib/oauth/providers";

export interface ProviderOption {
  id: ProviderId;
  label: string;
}

const icon = "h-5 w-5 shrink-0";

const ICONS: Record<ProviderId, React.ReactNode> = {
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={icon} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={icon} aria-hidden="true">
      <path d="M16 3c.3 2.3 1.8 3.9 4 4.1v3.1c-1.5 0-2.9-.5-4-1.3v6.4a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.2a2.3 2.3 0 1 0 1.4 2.1V3H16z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={icon} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/** One sign-up button per login the site has keys for. Plain links: the round trip is server redirects. */
export function SocialButtons({ providers }: { providers: ProviderOption[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="space-y-2">
      {providers.map(({ id, label }) => (
        <a
          key={id}
          href={`/api/auth/oauth/${id}/start?intent=waitlist`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-card px-5 py-3.5 font-semibold transition-colors hover:border-fairway-600"
        >
          {ICONS[id]}
          Continue with {label}
        </a>
      ))}
    </div>
  );
}
