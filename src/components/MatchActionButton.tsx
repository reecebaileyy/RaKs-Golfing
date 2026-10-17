"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One confirm-first button that POSTs to a match route and refreshes the page:
 * leaving a match, and the admin's dispute decisions.
 */
export function MatchActionButton({
  url,
  body,
  label,
  confirmText,
  confirmLabel = "Yes",
  tone = "neutral",
}: {
  url: string;
  body?: unknown;
  label: string;
  confirmText: string;
  confirmLabel?: string;
  tone?: "neutral" | "danger" | "primary";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  const color = tone === "danger" ? "text-red-700" : tone === "primary" ? "text-fairway-700" : "";
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`w-full rounded-xl border border-line bg-card py-3 font-medium ${color}`}>
        {label}
      </button>
    );
  }
  return (
    <div className="card space-y-3 p-4 text-sm">
      <p>{confirmText}</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line py-3 font-medium">Not now</button>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={`rounded-xl py-3 font-medium text-white disabled:opacity-60 ${tone === "danger" ? "bg-red-700" : "bg-fairway-700"}`}
        >
          {busy ? "One moment…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
