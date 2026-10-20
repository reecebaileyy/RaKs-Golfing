import Link from "next/link";
import { notFound } from "next/navigation";
import { cancellationQuote, getReservation } from "@/lib/booking";
import { formatCents } from "@/lib/money";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { CancelButton } from "@/components/CancelButton";

export const dynamic = "force-dynamic";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function ReservationPage({ params }: { params: Promise<{ code: string }> }) {
  const r = await getReservation((await params).code);
  if (!r) notFound();
  const { teeTime, rate } = r;
  const course = teeTime.course;
  const cancelled = r.status === "CANCELLED";
  const quote = cancellationQuote(r);
  const tz = course.timezone;

  let cancelSummary = "";
  if (quote.allowed) {
    cancelSummary = quote.refundable
      ? quote.refundCents > 0
        ? `You'll get ${formatCents(quote.refundCents)} back. The booking fee isn't refundable.`
        : "Nothing was prepaid for green fees, so there's nothing to refund. The booking fee isn't refundable."
      : `It's past the free cancellation cutoff (${formatTeeDate(quote.deadline, tz)} ${formatTeeTime(quote.deadline, tz)}), so nothing will be refunded.`;
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl p-5 text-white ${cancelled ? "bg-neutral-600" : "bg-fairway-700"}`}>
        <p className="text-sm opacity-80">{cancelled ? "Cancelled" : "You're booked"}</p>
        <h1 className="text-2xl font-bold">{course.name}</h1>
        <p className="mt-1 text-lg">
          {formatTeeDate(teeTime.startsAt, tz)} · {formatTeeTime(teeTime.startsAt, tz)}
        </p>
        <p className="mt-3 text-sm opacity-80">Confirmation</p>
        <p data-testid="confirmation-code" className="font-mono text-xl tracking-widest">{r.confirmationCode}</p>
      </div>

      <section className="card p-4 text-sm">
        <Row label="Golfers" value={String(r.players)} />
        <Row label="Rate" value={`${rate.isHotDeal ? "🔥 " : ""}${rate.name}`} />
        <Row label="Booked for" value={r.golfer.name} />
        <div className="my-2 border-t border-line" />
        <Row label="Green fees" value={formatCents(r.greenFeeTotalCents)} />
        <Row label="Taxes" value={formatCents(r.taxCents)} />
        <Row label="Booking fee" value={formatCents(r.convenienceFeeCents)} />
        {r.hasProtection && <Row label="Tee Time Protection" value={formatCents(r.protectionCents)} />}
        <div className="my-2 border-t border-line" />
        <Row label="Paid online" value={formatCents(r.dueOnlineCents)} strong />
        <Row label="Due at course" value={formatCents(r.dueAtCourseCents)} strong />
        {cancelled && r.refundCents !== null && <Row label="Refunded" value={formatCents(r.refundCents)} strong />}
      </section>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${course.address}, ${course.city}, ${course.state}`)}`}
        target="_blank"
        rel="noreferrer"
        className="card block p-4 text-sm"
      >
        <span className="font-semibold">Directions</span>
        <span className="block text-muted">{course.address}, {course.city}, {course.state}</span>
      </a>

      {!cancelled && quote.allowed && <CancelButton code={r.confirmationCode} summary={cancelSummary} />}

      <Link href="/" className="block text-center font-medium text-fairway-600">Book another tee time</Link>
    </div>
  );
}
