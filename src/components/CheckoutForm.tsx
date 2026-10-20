"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import { priceBooking, protectionAvailable, PROTECTION_PER_PLAYER_CENTS, type PaymentMode } from "@/lib/pricing";
import { maxLossCents } from "@/lib/golf/settlement";
import { MAX_STAKE_CENTS } from "@/lib/wagers/constants";
import { MatchSetupFields, type FormatOption, type MatchSetupValue, type TeeSetOption } from "@/components/MatchSetupFields";

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
  teeSets: TeeSetOption[];
  golferName: string;
  golferEmail: string;
  formats: FormatOption[];
  minStakeCents: number;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Checkout in two steps: set up the match, then pay for the booking and the wager hold together. */
export function CheckoutForm(props: Props) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((Date.parse(props.expiresAt) - Date.now()) / 1000)));
  const [step, setStep] = useState<"match" | "pay">("match");
  const fitting = props.formats.filter((f) => f.players === props.players);
  const [match, setMatch] = useState<MatchSetupValue>({
    format: fitting[0]?.value ?? null,
    scoring: "NET",
    stakeDollars: String(props.minStakeCents / 100),
    teeSetId: props.teeSets.find((t) => t.name === "White")?.id ?? props.teeSets[0]?.id ?? "",
    isOpenChallenge: false,
    pointVoteCents: 100,
  });
  const [golfer, setGolfer] = useState({ name: props.golferName, phone: "" });
  const [withProtection, setWithProtection] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedMatch, setAcceptedMatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((Date.parse(props.expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [props.expiresAt]);

  const price = useMemo(() => priceBooking({ ...props, withProtection }), [props, withProtection]);
  const stakeCents = Math.round(Number(match.stakeDollars) * 100);
  const stakeProblem =
    !Number.isInteger(Number(match.stakeDollars)) || !match.stakeDollars
      ? "Wagers are in whole dollars."
      : stakeCents < props.minStakeCents
        ? `The minimum wager is ${formatCents(props.minStakeCents)}.`
        : stakeCents > MAX_STAKE_CENTS
          ? `The most you can wager is ${formatCents(MAX_STAKE_CENTS)}.`
          : null;
  const wagerCents = match.format && !stakeProblem ? maxLossCents(match.format, stakeCents) : 0;
  const dueNowCents = price.dueOnlineCents + wagerCents;
  const expired = secondsLeft === 0;
  const prepaid = props.paymentMode === "PREPAID";
  const formatLabel = props.formats.find((f) => f.value === match.format)?.label;

  function next() {
    setError(null);
    if (!match.format) return setError("Pick a match format.");
    if (stakeProblem) return setError(stakeProblem);
    if (!match.teeSetId) return setError("Pick a set of tees.");
    setStep("pay");
    window.scrollTo({ top: 0 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        holdId: props.holdId,
        golfer,
        withProtection,
        acceptedPolicies: accepted && acceptedMatch,
        match: {
          format: match.format,
          scoring: match.scoring,
          stakeCents,
          teeSetId: match.teeSetId,
          isOpenChallenge: match.isOpenChallenge,
          pointVoteCents: match.format === "NINE_POINT" ? match.pointVoteCents : null,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error);
      return;
    }
    router.replace(`/reservations/${data.reservation.confirmationCode}`);
  }

  async function giveUp(players?: number) {
    await fetch(`/api/holds/${props.holdId}`, { method: "DELETE" });
    router.replace(`/tee-times/${props.teeTimeId}${players ? `?players=${players}` : ""}`);
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
  const timer = (
    <p role="timer" className={`rounded-xl px-4 py-2 text-center text-sm font-medium ${secondsLeft < 60 ? "bg-red-50 text-red-800" : "bg-fairway-50 text-fairway-900"}`}>
      We&apos;re holding this time for {mm}:{ss}
    </p>
  );
  const errorBox = error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>;

  if (fitting.length === 0) {
    return (
      <div className="space-y-4">
        {timer}
        <div role="alert" className="card p-6 text-center">
          <p className="font-semibold">Every booking is a match for 2, 3 or 4 golfers.</p>
          <p className="mt-1 text-sm text-muted">You&apos;re holding {props.players}. Pick the time again with 2 golfers for a 1v1.</p>
          <button type="button" onClick={() => giveUp(2)} className="mt-3 font-medium text-fairway-600">Change golfers</button>
        </div>
      </div>
    );
  }

  if (step === "match") {
    return (
      <div className="space-y-5">
        {timer}
        <div>
          <p className="text-sm font-semibold text-fairway-700">Step 1 of 2</p>
          <h2 className="text-xl font-bold">Set up your match</h2>
          <p className="text-sm text-muted">Every tee time is played for money. Minimum {formatCents(props.minStakeCents)}.</p>
        </div>
        <MatchSetupFields
          value={match}
          onChange={setMatch}
          formats={props.formats}
          teeSets={props.teeSets}
          players={props.players}
          minStakeCents={props.minStakeCents}
        />
        {errorBox}
        <div className="sticky bottom-16 z-10 -mx-4 space-y-2 border-t border-line bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={next} className="flex w-full items-center justify-between rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white">
            <span>Next: review and pay</span>
            <span>{formatCents(dueNowCents)}</span>
          </button>
          <button type="button" onClick={() => giveUp()} className="w-full py-1 text-sm text-muted">Release this time</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {timer}
      <div>
        <p className="text-sm font-semibold text-fairway-700">Step 2 of 2</p>
        <h2 className="text-xl font-bold">Review and pay</h2>
      </div>

      <section className="card p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">Your match</h3>
          <button type="button" onClick={() => setStep("match")} className="font-medium text-fairway-600">Change</button>
        </div>
        <Row label="Format" value={formatLabel ?? ""} />
        <Row label="Scoring" value={match.scoring === "NET" ? "Net" : "Gross"} />
        <Row label={match.format === "NINE_POINT" ? "Loss cap" : "Wager"} value={formatCents(stakeCents)} />
        {match.format === "NINE_POINT" && <Row label="Your vote" value={`${formatCents(match.pointVoteCents)} a point`} />}
        <Row label="Tees" value={props.teeSets.find((t) => t.id === match.teeSetId)?.name ?? ""} />
        <Row label="Opponents" value={match.isOpenChallenge ? "Open challenge" : "Invite friends"} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Golfer details</h2>
        <label className="block">
          <span className="mb-1 block text-sm">Full name</span>
          <input
            autoComplete="name"
            required
            value={golfer.name}
            onChange={(e) => setGolfer({ ...golfer, name: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Mobile (optional)</span>
          <input
            type="tel"
            autoComplete="tel"
            value={golfer.phone}
            onChange={(e) => setGolfer({ ...golfer, phone: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
          />
        </label>
        <p className="text-xs text-muted">Booking as {props.golferEmail}</p>
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
        <Row label="Wager hold (yours)" value={formatCents(wagerCents)} />
        <div className="my-2 border-t border-line" />
        <Row label="Due now" value={formatCents(dueNowCents)} strong />
        <Row label="Due at course" value={formatCents(price.dueAtCourseCents)} strong />
        <p data-testid="due-now" className="mt-2 rounded-lg bg-fairway-50 px-3 py-2 text-fairway-900">
          Due now: {prepaid ? "tee time" : "booking fee"} {formatCents(price.dueOnlineCents)} + wager {formatCents(wagerCents)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {prepaid ? "This rate is prepaid in full." : "Pay your green fees at the pro shop."} The wager is held, not spent: it
          comes back in full if nobody joins or you cancel before the match starts, and winnings go to your wallet. Demo money: no real
          cards are charged.
        </p>
      </section>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 accent-fairway-700" />
        <span>
          I agree to the course policies. Cancel at least {withProtection ? "1 hour" : `${props.cancelWindowHours} hours`} before
          the tee time for a refund of green fees. The booking fee isn&apos;t refundable.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={acceptedMatch} onChange={(e) => setAcceptedMatch(e.target.checked)} className="mt-0.5 size-5 accent-fairway-700" />
        <span>
          I agree to the match terms: {formatLabel?.toLowerCase()}, {match.scoring === "NET" ? "net" : "gross"}, and{" "}
          {formatCents(wagerCents)} held until the match settles.
        </span>
      </label>

      {errorBox}

      <div className="sticky bottom-16 z-10 -mx-4 space-y-2 border-t border-line bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <button type="submit" disabled={busy} className="flex w-full items-center justify-between rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
          <span>{busy ? "Booking…" : "Book tee time"}</span>
          <span>{formatCents(dueNowCents)}</span>
        </button>
        <button type="button" onClick={() => setStep("match")} className="w-full py-1 text-sm text-muted">Back to match setup</button>
      </div>
    </form>
  );
}
