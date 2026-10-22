"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";

export interface SpotCardProps {
  position: number;
  total: number;
  referrals: number;
  inviteUrl: string;
  /** How they signed up, e.g. "email" or "TikTok". */
  signedUpWith: string;
  /** Where we'll reach them: their email or formatted phone number. */
  contact: string | null;
  linked: { label: string; username: string | null }[];
  connect: { label: string; href: string }[];
}

const pill = "rounded-full border border-line px-3 py-1.5 text-sm font-medium";

/** The signed-in golfer's place on the list, their invite link and their connected logins. */
export function SpotCard({ position, total, referrals, inviteUrl, signedUpWith, contact, linked, connect }: SpotCardProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (older browser, plain http): select it so they can copy by hand.
      input.current?.select();
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "RaKs Golfing",
        text: "Every round is a match. Join me on the RaKs Golfing waitlist.",
        url: inviteUrl,
      });
    } catch {
      // They closed the share sheet.
    }
  }

  return (
    <section
      id="spot"
      tabIndex={-1}
      data-testid="waitlist-spot"
      className="card scroll-mt-6 text-[var(--foreground)] space-y-5 p-5 shadow-2xl shadow-black/30 outline-none sm:p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-fairway-700 dark:text-fairway-100">You&apos;re in</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">You&apos;re #{position} on the list</h2>
        <p className="mt-1 text-sm text-muted">
          {referrals} {referrals === 1 ? "golfer" : "golfers"} joined with your link
          {total > 1 && <> · {total.toLocaleString("en-US")} signed up so far</>}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="invite-link" className="block text-sm">
          Your invite link
        </label>
        <div className="flex gap-2">
          <input
            id="invite-link"
            ref={input}
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-3 text-sm outline-none focus:border-fairway-600"
          />
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="shrink-0 rounded-xl bg-fairway-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-fairway-600"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="w-full rounded-xl border border-line px-4 py-3 text-sm font-semibold transition-colors hover:border-fairway-600"
          >
            Share invite
          </button>
        )}
        <p className="text-xs text-muted">Matches need golfers near you. Send this to your playing partners.</p>
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <p className="text-sm">
          Signed up with <strong>{signedUpWith}</strong>.
          {contact && <span className="text-muted"> We&apos;ll reach you at {contact} when matches open.</span>}
        </p>
        {(linked.length > 0 || connect.length > 0) && (
          <ul className="flex flex-wrap gap-2">
            {linked.map((l, i) => (
              <li key={`${l.label}-${i}`} className={`${pill} bg-fairway-50 text-fairway-900 dark:bg-fairway-900 dark:text-fairway-100`}>
                {l.label}
                {l.username && <span className="opacity-70"> @{l.username.replace(/^@/, "")}</span>}
              </li>
            ))}
            {connect.map((c) => (
              <li key={c.label}>
                <a href={c.href} className={`${pill} block transition-colors hover:border-fairway-600`}>
                  Connect {c.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <SignOutButton />
      </div>
    </section>
  );
}
