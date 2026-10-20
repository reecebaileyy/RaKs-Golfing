import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listUserReservations } from "@/lib/booking";
import { formatCents } from "@/lib/money";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { MyTeeTimes } from "@/components/MyTeeTimes";
import { STATUS_LABEL } from "@/components/MatchCard";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    // Guest bookings from before accounts are still found by email.
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">My tee times</h1>
        <p className="text-sm text-muted">
          <Link href="/signin?next=/reservations" className="font-medium text-fairway-600">Sign in</Link> to see your bookings and matches.
        </p>
        <MyTeeTimes />
      </div>
    );
  }

  const reservations = await listUserReservations(user.id);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">My tee times</h1>
        <Link href="/matches" className="text-sm font-medium text-fairway-600">Matches</Link>
      </div>
      {reservations.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-muted">No tee times yet.</p>
          <Link href="/" className="mt-2 inline-block font-medium text-fairway-600">Find a tee time</Link>
        </div>
      )}
      <ul className="space-y-3">
        {reservations.map((r) => {
          const tz = r.teeTime.course.timezone;
          return (
            <li key={r.id}>
              <Link href={`/reservations/${r.confirmationCode}`} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.teeTime.course.name}</p>
                  <p className="text-sm text-muted">
                    {formatTeeDate(r.teeTime.startsAt, tz)} · {formatTeeTime(r.teeTime.startsAt, tz)} · {r.players} {r.players === 1 ? "golfer" : "golfers"}
                  </p>
                  {r.match && <p className="text-xs text-muted">Match: {STATUS_LABEL[r.match.status]}</p>}
                </div>
                <span className={`shrink-0 text-sm ${r.status === "CANCELLED" ? "text-muted" : "text-fairway-600"}`}>
                  {r.status === "CANCELLED" ? "Cancelled" : r.dueAtCourseCents ? `${formatCents(r.dueAtCourseCents)} at course` : "Paid"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
