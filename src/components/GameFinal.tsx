"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { PlayView } from "@/lib/live";

const first = (name: string) => name.trim().split(/\s+/)[0];

/** After 18: final result, confirm or dispute the card, and the settled money. */
export function GameFinal({ view, onConfirm, onDispute }: {
  view: PlayView;
  onConfirm: () => Promise<string | null>;
  onDispute: (reason: string) => Promise<string | null>;
}) {
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else setDisputing(false);
  }

  const result = view.pairings?.map((p) => p.summary).join(" · ");

  if (view.status === "DISPUTED") {
    const who = view.money.filter((m) => m.disputed);
    return (
      <section className="space-y-2 rounded-2xl border-2 border-flame bg-card p-4" aria-label="Disputed card">
        <h2 className="text-xl font-black text-flame">Card disputed</h2>
        <p className="text-sm">The money stays held while we review. Nobody is paid until it&apos;s sorted out.</p>
        {who.map((m) => (
          <p key={m.userId} className="text-sm text-muted">{first(m.name)}: {m.disputeReason ?? "no reason given"}</p>
        ))}
      </section>
    );
  }

  if (view.status === "SETTLED") {
    return (
      <section className="space-y-3 rounded-2xl border-2 border-fairway-700 bg-card p-4" aria-label="Final result">
        <h2 className="text-xl font-black">Settled</h2>
        {result && <p className="text-lg font-bold">{result}</p>}
        <ul className="space-y-1">
          {view.money.map((m) => (
            <li key={m.userId} className="flex justify-between text-lg">
              <span>{first(m.name)}</span>
              <span className={`font-extrabold tabular-nums ${(m.resultCents ?? 0) > 0 ? "text-fairway-700" : (m.resultCents ?? 0) < 0 ? "text-red-700" : ""}`}>
                {m.resultCents == null ? "-" : `${m.resultCents > 0 ? "+" : ""}${formatCents(m.resultCents)}`}
              </span>
            </li>
          ))}
        </ul>
        {view.presses.length > 0 && (
          <ul className="border-t border-line pt-2 text-sm">
            {view.presses.map((p, i) => (
              <li key={i}>ALOHA PRESS on {p.holeNumber} ({p.callerSide}): {p.outcome ? OUTCOME[p.outcome] ?? p.outcome : "pending"}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // CONFIRMING
  const waiting = view.money.filter((m) => !m.confirmed).map((m) => first(m.name));
  return (
    <section className="space-y-3 rounded-2xl border-2 border-fairway-700 bg-card p-4" aria-label="Final card">
      <h2 className="text-xl font-black">Final card</h2>
      {result && <p className="text-lg font-bold">{result}</p>}
      <p className="text-sm text-muted">
        Check the Scorecard tab. {view.me.confirmed ? `You confirmed. Waiting on ${waiting.join(", ") || "no one"}.` : "Money moves once every player confirms."}
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!view.me.confirmed && !disputing && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDisputing(true)} className="rounded-xl border border-line py-4 font-semibold">Dispute</button>
          <button type="button" onClick={() => run(onConfirm)} disabled={busy} className="rounded-xl bg-fairway-700 py-4 font-bold text-white disabled:opacity-60">
            {busy ? "One moment…" : "Confirm card"}
          </button>
        </div>
      )}
      {disputing && (
        <div className="space-y-2">
          <label className="block text-sm">
            What&apos;s wrong with the card?
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-base"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDisputing(false)} className="rounded-xl border border-line py-3 font-semibold">Back</button>
            <button type="button" onClick={() => run(() => onDispute(reason))} disabled={busy || reason.trim().length < 3} className="rounded-xl bg-red-700 py-3 font-bold text-white disabled:opacity-60">
              Send dispute
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const OUTCOME: Record<string, string> = { WON: "won, bets washed", TIED: "tied, match stood", LOST: "lost, paid double", MOOT: "moot" };
