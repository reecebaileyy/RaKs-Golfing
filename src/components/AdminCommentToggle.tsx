"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Hide or show one wall comment. `hidden` is its current state. */
export function AdminCommentToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/waitlist/comments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: !hidden }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button type="button" disabled={busy} onClick={toggle} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {hidden ? "Show" : "Hide"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
