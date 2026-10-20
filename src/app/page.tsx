import Link from "next/link";
import { Suspense } from "react";
import { searchTeeTimes } from "@/lib/booking";
import { formatCents } from "@/lib/money";
import { addDays, formatTeeTime, todayIn, type TimeOfDay } from "@/lib/time";
import { SearchFilters, type DateOption } from "@/components/SearchFilters";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

type Params = Promise<Record<string, string | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const today = todayIn(TZ);
  const dates: DateOption[] = Array.from({ length: 10 }, (_, i) => {
    const ymd = addDays(today, i);
    const d = new Date(`${ymd}T12:00:00Z`);
    return {
      ymd,
      weekday: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      day: String(d.getUTCDate()),
    };
  });
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const players = sp.players ? Number(sp.players) : undefined;

  const results = await searchTeeTimes({
    date,
    players,
    holes: sp.holes === "9" ? 9 : sp.holes === "18" ? 18 : undefined,
    hotDealsOnly: sp.hotDeals === "1",
    timeOfDay: (["morning", "midday", "twilight"] as const).includes(sp.time as TimeOfDay) ? (sp.time as TimeOfDay) : undefined,
    q: sp.q?.trim() || undefined,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Find a tee time</h1>
      <Suspense>
        <SearchFilters dates={dates} />
      </Suspense>

      {results.length === 0 ? (
        <p className="card p-6 text-center text-muted">No tee times match. Try another day or fewer filters.</p>
      ) : (
        <ul className="space-y-4">
          {results.map(({ course, times }) => (
            <li key={course.id} className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">{course.name}</h2>
                <span className="shrink-0 text-xs text-muted">{course.city}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {times.length} times · from {formatCents(Math.min(...times.map((t) => t.fromCents)))}
              </p>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
                {times.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tee-times/${t.id}${players ? `?players=${players}` : ""}`}
                    className="relative flex w-24 shrink-0 flex-col rounded-xl border border-line px-3 py-2 active:bg-fairway-50"
                  >
                    {t.hasHotDeal && <span className="absolute right-1.5 top-1 text-xs" aria-label="Hot Deal">🔥</span>}
                    <span className="font-semibold">{formatTeeTime(t.startsAt, course.timezone)}</span>
                    <span className="text-sm text-fairway-600">{formatCents(t.fromCents)}</span>
                    <span className="text-xs text-muted">
                      {t.spotsLeft} {t.spotsLeft === 1 ? "spot" : "spots"} · {t.holes.join("/")}h
                    </span>
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
