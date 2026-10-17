import Link from "next/link";
import { notFound } from "next/navigation";
import { bookingFeeCents, getTeeTime } from "@/lib/booking";
import { MAX_PLAYERS } from "@/lib/pricing";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { RatePicker } from "@/components/RatePicker";

export const dynamic = "force-dynamic";

export default async function TeeTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ players?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const teeTime = await getTeeTime(id);
  if (!teeTime) notFound();
  const { course } = teeTime;
  const gone = teeTime.startsAt <= new Date() || teeTime.spotsLeft < teeTime.minPlayers;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-fairway-600">← All tee times</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
        <p className="text-muted">
          {formatTeeDate(teeTime.startsAt, course.timezone)} at{" "}
          <span className="font-semibold text-[var(--foreground)]">{formatTeeTime(teeTime.startsAt, course.timezone)}</span>
        </p>
        <p className="text-sm text-muted">{course.address}, {course.city}, {course.state}</p>
      </div>

      {gone ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">This tee time is no longer available.</p>
          <Link href="/" className="mt-3 inline-block font-medium text-fairway-600">View available times</Link>
        </div>
      ) : (
        <RatePicker
          rates={teeTime.rates.map((r) => ({ ...r, bookingFeeCents: bookingFeeCents(r, course) }))}
          tax={{ taxRateBps: course.taxRateBps, taxIncluded: course.taxIncluded }}
          minPlayers={teeTime.minPlayers}
          maxPlayers={Math.min(MAX_PLAYERS, teeTime.spotsLeft)}
          initialPlayers={sp.players ? Number(sp.players) : undefined}
          timeZone={course.timezone}
        />
      )}

      <details className="card p-4 text-sm">
        <summary className="font-semibold">Notes &amp; policies</summary>
        <p className="mt-2 text-muted">{course.policyNotes}</p>
      </details>
    </div>
  );
}
