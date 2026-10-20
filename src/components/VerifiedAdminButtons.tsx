"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifiedAdminButtons({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "verify" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => act("verify")} className="flex-1 rounded-xl bg-fairway-700 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60">
          Verified on GHIN
        </button>
        <button type="button" disabled={busy} onClick={() => act("reject")} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold disabled:opacity-60">
          Reject
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
