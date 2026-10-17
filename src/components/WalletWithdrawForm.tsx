"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/money";

/** Fake "Withdraw to bank". One request id per attempt, so a double tap withdraws once. */
export function WalletWithdrawForm({ walletCents }: { walletCents: number }) {
  const router = useRouter();
  const [dollars, setDollars] = useState(walletCents > 0 ? (walletCents / 100).toFixed(2) : "");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amountCents = Math.round(Number(dollars) * 100);
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents, requestId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: data.error });
      return;
    }
    setRequestId(crypto.randomUUID());
    setDollars("");
    setMessage({ ok: true, text: `${formatCents(amountCents)} is on its way to your bank (demo).` });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-semibold">Withdraw to bank</h2>
      <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 focus-within:border-fairway-600">
        <span className="text-lg font-semibold">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          max={walletCents / 100}
          aria-label="Amount to withdraw"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
      </label>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${message.ok ? "bg-fairway-50 text-fairway-900" : "border border-red-300 bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={busy || walletCents <= 0} className="w-full rounded-xl bg-fairway-700 py-4 font-semibold text-white disabled:opacity-50">
        {busy ? "Sending…" : "Withdraw"}
      </button>
    </form>
  );
}
