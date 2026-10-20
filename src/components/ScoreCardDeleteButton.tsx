"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScoreCardDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete score card"
      onClick={async () => {
        if (!confirm("Delete this score card?")) return;
        setBusy(true);
        await fetch(`/api/scorecards/${id}`, { method: "DELETE" });
        router.refresh();
      }}
      className="text-xs text-muted underline disabled:opacity-50"
    >
      Delete
    </button>
  );
}
