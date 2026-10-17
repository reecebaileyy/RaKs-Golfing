"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ code, summary }: { code: string; summary: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    const res = await fetch(`/api/reservations/${code}/cancel`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="w-full rounded-xl border border-line bg-card py-3 font-medium text-red-700">
        Cancel reservation
      </button>
    );
  }
  return (
    <div className="card space-y-3 p-4 text-sm">
      <p>{summary}</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line py-3 font-medium">Keep it</button>
        <button type="button" onClick={cancel} disabled={busy} className="rounded-xl bg-red-700 py-3 font-medium text-white disabled:opacity-60">
          {busy ? "Cancelling…" : "Yes, cancel"}
        </button>
      </div>
    </div>
  );
}
