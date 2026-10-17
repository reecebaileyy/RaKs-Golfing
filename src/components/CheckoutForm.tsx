"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import { priceBooking, protectionAvailable, PROTECTION_PER_PLAYER_CENTS, type PaymentMode } from "@/lib/pricing";

import { GOLFER_KEY } from "@/lib/storage";

interface Props {
  holdId: string;
  expiresAt: string;
  players: number;
  greenFeeCents: number;
  paymentMode: PaymentMode;
  convenienceFeeCents: number;
  taxRateBps: number;
  taxIncluded: boolean;
  cancelWindowHours: number;
  teeTimeId: string;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function CheckoutForm(props: Props) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((Date.parse(props.expiresAt) - Date.now()) / 1000)));
  const [golfer, setGolfer] = useState({ name: "", email: "", phone: "" });
  const [withProtection, setWithProtection] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GOLFER_KEY);
      if (saved) setGolfer((g) => ({ ...g, ...JSON.parse(saved) }));
    } catch {}
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((Date.parse(props.expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [props.expiresAt]);

  const price = useMemo(() => priceBooking({ ...props, withProtection }), [props, withProtection]);
  const expired = secondsLeft === 0;
  const prepaid = props.paymentMode === "PREPAID";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holdId: props.holdId, golfer, withProtection, acceptedPolicies: accepted }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error);
      return;
    }
    try {
      localStorage.setItem(GOLFER_KEY, JSON.stringify({ name: golfer.name, email: golfer.email, phone: golfer.phone }));
    } catch {}
    router.replace(`/reservations/${data.reservation.confirmationCode}`);
  }

  async function giveUp() {
    await fetch(`/api/holds/${props.holdId}`, { method: "DELETE" });
    router.replace(`/tee-times/${props.teeTimeId}`);
  }

  if (expired) {
    return (
      <div className="card p-6 text-center">
        <p className="font-semibold">Your 5 minute hold ran out.</p>
        <p className="mt-1 text-sm text-muted">The time went back on the tee sheet. It may still be open.</p>
        <Link href={`/tee-times/${props.teeTimeId}`} className="mt-3 inline-block font-medium text-fairway-600">Try this time again</Link>
      </div>
    );
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <form onSubmit={submit} className="space-y-5">
      <p role="timer" className={`rounded-xl px-4 py-2 text-center text-sm font-medium ${secondsLeft < 60 ? "bg-red-50 text-red-800" : "bg-fairway-50 text-fairway-900"}`}>
        We&apos;re holding this time for {mm}:{ss}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Golfer details</h2>
        {(
          [
            ["name", "Full name", "text", "name"],
            ["email", "Email", "email", "email"],
            ["phone", "Mobile (optional)", "tel", "tel"],
          ] as const
        ).map(([key, label, type, autoComplete]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-sm">{label}</span>
            <input
              type={type}
              autoComplete={autoComplete}
              required={key !== "phone"}
              value={golfer[key]}
              onChange={(e) => setGolfer({ ...golfer, [key]: e.target.value })}
              className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
            />
          </label>
        ))}
      </section>

      {protectionAvailable(props.paymentMode) && (
        <label className="card flex cursor-pointer items-start gap-3 p-4">
          <input type="checkbox" checked={withProtection} onChange={(e) => setWithProtection(e.target.checked)} className="mt-1 size-5 accent-fairway-700" />
          <span>
            <span className="font-semibold">Add Tee Time Protection</span>{" "}
            <span className="text-muted">({formatCents(PROTECTION_PER_PLAYER_CENTS)}/golfer)</span>
            <span className="block text-sm text-muted">Cancel for a refund up to 1 hour before your tee time instead of {props.cancelWindowHours} hours.</span>
          </span>
        </label>
      )}

      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-semibold">Price</h2>
        <Row label={`Green fees (${props.players} × ${formatCents(props.greenFeeCents)})`} value={formatCents(price.greenFeeTotalCents)} />
        <Row label={props.taxIncluded ? "Taxes (included)" : "Taxes"} value={formatCents(price.taxCents)} />
        <Row label="Booking fee" value={formatCents(price.convenienceFeeCents)} />
        {price.protectionCents > 0 && <Row label="Tee Time Protection" value={formatCents(price.protectionCents)} />}
        <div className="my-2 border-t border-line" />
        <Row label="Due now" value={formatCents(price.dueOnlineCents)} strong />
        <Row label="Due at course" value={formatCents(price.dueAtCourseCents)} strong />
        <p className="mt-2 text-xs text-muted">
          {prepaid
            ? "This rate is prepaid in full."
            : "Pay your green fees at the pro shop. Only the booking fee is charged now."}{" "}
          Demo checkout: no card is charged yet.
        </p>
      </section>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 accent-fairway-700" />
        <span>
          I agree to the course policies. Cancel at least {withProtection ? "1 hour" : `${props.cancelWindowHours} hours`} before
          the tee time for a refund of green fees. The booking fee isn&apos;t refundable.
        </span>
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="sticky bottom-16 z-10 -mx-4 space-y-2 border-t border-line bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <button type="submit" disabled={busy} className="flex w-full items-center justify-between rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
          <span>{busy ? "Booking…" : "Book tee time"}</span>
          <span>{formatCents(price.dueOnlineCents)}</span>
        </button>
        <button type="button" onClick={giveUp} className="w-full py-1 text-sm text-muted">Release this time</button>
      </div>
    </form>
  );
}
