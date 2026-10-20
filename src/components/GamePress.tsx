"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { PlayView, PressOption } from "@/lib/live";

/** The ALOHA PRESS button for each opponent side the viewer's side may press, with a confirm sheet. */
export function GamePress({ view, onCall }: { view: PlayView; onCall: (opponentSide: number, holeNumber: number) => Promise<string | null> }) {
  const options = view.pressOptions.filter((o) => o.eligible && o.holes.length > 0);
  const [open, setOpen] = useState<PressOption | null>(null);
  const [hole, setHole] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) return null;

  async function call() {
    if (!open || hole == null) return;
    setBusy(true);
    setError(null);
    const err = await onCall(open.opponentSide, hole);
    setBusy(false);
    if (err) setError(err);
    else setOpen(null);
  }

  if (open) {
    const chosen = hole ?? open.holes[0];
    const teammates = view.players.filter((p) => p.side === view.me.side).length;
    return (
      <section aria-label="Confirm ALOHA PRESS" className="space-y-3 rounded-2xl border-2 border-flame bg-card p-4">
        <h2 className="text-2xl font-black text-flame">ALOHA PRESS</h2>
        <p className="font-semibold">Double or nothing on hole {chosen}, against {open.opponentName}.</p>
        {open.holes.length > 1 && (
          <div role="radiogroup" aria-label="Hole to press" className="flex flex-wrap gap-2">
            {open.holes.map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={n === chosen}
                onClick={() => setHole(n)}
                className={`h-12 w-12 rounded-xl border-2 text-lg font-bold ${n === chosen ? "border-flame bg-flame text-white" : "border-line"}`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Win the hole: all bets washed.</li>
          <li>Tie: the match stays as is.</li>
          <li>Lose: you pay double ({formatCents(open.loseCents)}).</li>
        </ul>
        <p className="text-sm text-muted">
          We hold an extra {formatCents(open.holdCentsEach)} now{teammates > 1 ? " from each player on your side" : " on your card"}. You get it back unless you lose the hole.
        </p>
        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(null)} className="rounded-xl border border-line py-4 font-semibold">Not yet</button>
          <button type="button" onClick={call} disabled={busy} className="rounded-xl bg-flame py-4 font-black text-white disabled:opacity-60">
            {busy ? "Calling…" : "Call it"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.opponentSide}
          type="button"
          onClick={() => {
            setOpen(o);
            setHole(o.holes[o.holes.length - 1]);
          }}
          className="w-full rounded-2xl bg-flame px-4 py-5 text-center text-white shadow-lg active:brightness-90"
        >
          <span className="block text-3xl font-black tracking-wide">ALOHA PRESS</span>
          <span className="block text-sm font-semibold">
            vs {o.opponentName} · hole{o.holes.length > 1 ? "s" : ""} {o.holes.join(", ")}
          </span>
        </button>
      ))}
    </div>
  );
}
