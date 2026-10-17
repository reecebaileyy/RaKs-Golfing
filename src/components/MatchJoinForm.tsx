"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/money";
import { POINT_VALUES } from "@/lib/wagers/constants";

export interface OpenSide {
  side: number;
  label: string;
  /** Who's already on that side, for fourball partners. */
  with: string[];
}

/** Join a match: pick a free spot, accept the terms, vote (nine point) and pay the wager hold. */
export function MatchJoinForm({
  code,
  sides,
  holdCents,
  ninePoint,
  terms,
}: {
  code: string;
  sides: OpenSide[];
  holdCents: number;
  ninePoint: boolean;
  terms: string;
}) {
  const router = useRouter();
  const [side, setSide] = useState(sides[0]?.side ?? 0);
  const [vote, setVote] = useState<number>(POINT_VALUES[0]);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/matches/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ side, acceptedTerms: accepted, pointVoteCents: ninePoint ? vote : null }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={join} className="card space-y-4 p-4">
      <h2 className="text-lg font-bold">Join this match</h2>
      {sides.length > 1 && (
        <div className="space-y-2" role="radiogroup" aria-label="Pick your spot">
          {sides.map((s) => (
            <button
              key={s.side}
              type="button"
              role="radio"
              aria-checked={side === s.side}
              onClick={() => setSide(s.side)}
              className={`w-full rounded-xl border p-3 text-left ${side === s.side ? "border-fairway-700 ring-2 ring-fairway-700/20" : "border-line"}`}
            >
              <span className="font-semibold">{s.label}</span>
              {s.with.length > 0 && <span className="block text-sm text-muted">Partner: {s.with.join(", ")}</span>}
            </button>
          ))}
        </div>
      )}
      {ninePoint && (
        <div>
          <p className="mb-2 text-sm font-semibold">Your vote: per point</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Point value vote">
            {POINT_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={vote === v}
                onClick={() => setVote(v)}
                className={`rounded-xl border py-3 font-semibold ${vote === v ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"}`}
              >
                {formatCents(v).replace(".00", "")}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 accent-fairway-700" />
        <span>I accept the match terms: {terms}. Leave any time before everyone&apos;s in for a full refund.</span>
      </label>
      <p data-testid="due-now" className="rounded-lg bg-fairway-50 px-3 py-2 text-sm text-fairway-900">
        Due now: wager {formatCents(holdCents)}. Held until the match settles. Demo money: no real cards are charged.
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-between rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
        <span>{busy ? "Joining…" : "Join and pay"}</span>
        <span>{formatCents(holdCents)}</span>
      </button>
    </form>
  );
}
