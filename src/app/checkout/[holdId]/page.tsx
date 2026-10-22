import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { bookingFeeCents, getHold } from "@/lib/booking";
import { FORMAT_LABEL, FORMAT_SIZE, MIN_STAKE_CENTS } from "@/lib/matchData";
import { canPlayMatches } from "@/lib/profile";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { AddEmailForm } from "@/components/AddEmailForm";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const user = await requireUser(`/checkout/${holdId}`);
  const hold = await getHold(holdId);
  if (!hold) notFound();
  if (hold.reservation) redirect(`/reservations/${hold.reservation.confirmationCode}`);
  const { teeTime, rate } = hold;
  const course = teeTime.course;
  const eligible = await canPlayMatches(user.id);

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
      ) : !eligible.ok ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Set up your handicap first</p>
          <p className="mt-1 text-sm text-muted">{eligible.reason ?? "Every booking is a match, so we need your handicap."}</p>
          <Link href={`/onboarding?next=${encodeURIComponent(`/checkout/${hold.id}`)}`} className="mt-3 inline-block font-medium text-fairway-600">
            Set up my profile
          </Link>
        </div>
      ) : !user.email ? (
        <div className="card space-y-3 p-6">
          <div className="text-center">
            <p className="font-semibold">Add your email to book</p>
            <p className="mt-1 text-sm text-muted">The course confirmation and your receipt go to it.</p>
          </div>
          <AddEmailForm />
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
          teeSets={course.teeSets.map((t) => ({ id: t.id, name: t.name, courseRating: t.courseRating, slope: t.slope, yards: t.yards }))}
          golferName={user.name}
          golferEmail={user.email}
          formats={(Object.keys(FORMAT_SIZE) as (keyof typeof FORMAT_SIZE)[]).map((f) => ({
            value: f,
            label: FORMAT_LABEL[f],
            players: FORMAT_SIZE[f].players,
          }))}
          minStakeCents={MIN_STAKE_CENTS}
        />
      )}
    </div>
  );
}
