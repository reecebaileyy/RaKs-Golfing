"use client";

import { useEffect, useState } from "react";

/** The match's invite link with Share (phones) and Copy buttons. */
export function MatchInviteLink({ code, title }: { code: string; title: string }) {
  const [url, setUrl] = useState(`/matches/${code}`);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/matches/${code}`);
    setCanShare(typeof navigator.share === "function");
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function share() {
    try {
      await navigator.share({ title, text: `${title}. Join my match on RaKs Golfing:`, url });
    } catch {}
  }

  return (
    <div className="space-y-2">
      <p data-testid="invite-link" className="break-all rounded-xl border border-line bg-[var(--background)] px-3 py-2 font-mono text-sm">{url}</p>
      <div className="grid grid-cols-2 gap-2">
        {canShare && (
          <button type="button" onClick={share} className="rounded-xl bg-fairway-700 py-3 font-semibold text-white">Share invite</button>
        )}
        <button type="button" onClick={copy} className={`rounded-xl border border-line bg-card py-3 font-semibold ${canShare ? "" : "col-span-2"}`}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
