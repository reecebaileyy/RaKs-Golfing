import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { bookingFeeCents, getHold } from "@/lib/booking";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ holdId: string }> }) {
  const hold = await getHold((await params).holdId);
  if (!hold) notFound();
  if (hold.reservation) redirect(`/reservations/${hold.reservation.confirmationCode}`);
  const { teeTime, rate } = hold;
  const course = teeTime.course;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">Checkout</p>
        <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
        <p className="text-muted">
          {formatTeeDate(teeTime.startsAt, course.timezone)} · {formatTeeTime(teeTime.startsAt, course.timezone)} · {hold.players}{" "}
          {hold.players === 1 ? "golfer" : "golfers"}
        </p>
        <p className="text-sm">{rate.isHotDeal && "🔥 "}{rate.name}</p>
      </div>
      {hold.status !== "ACTIVE" ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">This hold was released.</p>
          <Link href={`/tee-times/${teeTime.id}`} className="mt-3 inline-block font-medium text-fairway-600">Pick the time again</Link>
        </div>
      ) : (
        <CheckoutForm
          holdId={hold.id}
          expiresAt={hold.expiresAt.toISOString()}
          players={hold.players}
          greenFeeCents={rate.greenFeeCents}
          paymentMode={rate.paymentMode}
          convenienceFeeCents={bookingFeeCents(rate, course)}
          taxRateBps={course.taxRateBps}
          taxIncluded={course.taxIncluded}
          cancelWindowHours={course.cancelWindowHours}
          teeTimeId={teeTime.id}
        />
      )}
    </div>
  );
}
