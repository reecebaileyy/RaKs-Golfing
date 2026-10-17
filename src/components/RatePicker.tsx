"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/money";

export interface RateOption {
  id: string;
  name: string;
  holes: number;
  cartIncluded: boolean;
  greenFeeCents: number;
  rackRateCents: number | null;
  isHotDeal: boolean;
  paymentMode: "PREPAID" | "PAY_AT_COURSE";
}

interface Alternative {
  teeTimeId: string;
  startsAt: string;
  spotsLeft: number;
}

export function RatePicker({
  rates,
  minPlayers,
  maxPlayers,
  initialPlayers,
  timeZone,
}: {
  rates: RateOption[];
  minPlayers: number;
  maxPlayers: number;
  initialPlayers?: number;
  timeZone: string;
}) {
  const router = useRouter();
  const [rateId, setRateId] = useState(rates[0]?.id);
  const clamp = (n: number) => Math.min(maxPlayers, Math.max(minPlayers, n));
  const [players, setPlayers] = useState(clamp(initialPlayers ?? Math.min(2, maxPlayers)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  const rate = rates.find((r) => r.id === rateId);
  const playerOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i);

  async function hold() {
    if (!rate) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/holds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rateId: rate.id, players }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/checkout/${data.hold.id}`);
      return;
    }
    setBusy(false);
    setError(data.error);
    setAlternatives(data.alternatives ?? []);
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Golfers</h2>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Golfers">
          {[1, 2, 3, 4].map((n) => {
            const enabled = playerOptions.includes(n);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={players === n}
                aria-label={`${n} ${n === 1 ? "golfer" : "golfers"}`}
                disabled={!enabled}
                onClick={() => setPlayers(n)}
                className={`rounded-xl border py-3 text-lg font-semibold disabled:opacity-30 ${
                  players === n ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        {minPlayers > 1 && <p className="mt-2 text-xs text-muted">This time needs at least {minPlayers} golfers.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Rate</h2>
        <div className="space-y-2" role="radiogroup" aria-label="Rate">
          {rates.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={rateId === r.id}
              onClick={() => setRateId(r.id)}
              className={`card flex w-full items-center justify-between gap-3 p-4 text-left ${
                rateId === r.id ? "!border-fairway-700 ring-2 ring-fairway-700/20" : ""
              }`}
            >
              <div>
                <div className="font-semibold">
                  {r.isHotDeal && <span className="mr-1 text-flame">🔥</span>}
                  {r.name}
                </div>
                <div className="text-xs text-muted">
                  {r.holes} holes · {r.cartIncluded ? "Cart included" : "Walking"} ·{" "}
                  {r.paymentMode === "PREPAID" ? "Prepaid, non-refundable inside the window" : "Pay at course"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {r.rackRateCents && <div className="text-xs text-muted line-through">{formatCents(r.rackRateCents)}</div>}
                <div className="font-semibold">{formatCents(r.greenFeeCents)}</div>
                <div className="text-[11px] text-muted">per golfer</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {alternatives.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="w-full text-xs">Closest open times:</span>
              {alternatives.map((a) => (
                <a key={a.teeTimeId} href={`/tee-times/${a.teeTimeId}?players=${players}`} className="rounded-full border border-red-300 bg-white px-3 py-1 font-medium">
                  {new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(a.startsAt))}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={hold}
          disabled={!rate || busy}
          className="flex w-full items-center justify-between rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60"
        >
          <span>{busy ? "Holding your time…" : "Continue"}</span>
          {rate && <span>{formatCents(rate.greenFeeCents * players)}</span>}
        </button>
      </div>
    </div>
  );
}
