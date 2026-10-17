import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import {
  getLeaderboard,
  LEADERBOARD_PERIODS,
  LEADERBOARD_SORTS,
  type LeaderboardPeriod,
  type LeaderboardSort,
} from "@/lib/ranking";
import { MIN_MATCHES, RANKING_WEIGHTS, UNVERIFIED_WEIGHT } from "@/lib/rankingMath";
import { LeaderboardCourseSelect } from "@/components/LeaderboardCourseSelect";
import { LeaderboardList } from "@/components/LeaderboardList";

export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | undefined>>;

const SORT_LABEL: Record<LeaderboardSort, string> = {
  ranking: "Ranking",
  scoring: "Scoring avg",
  matches: "Matches",
  earnings: "Earnings",
};

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  all: "All time",
  year: "This year",
  "30d": "Last 30 days",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function LeaderboardPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const sort = LEADERBOARD_SORTS.find((s) => s === sp.sort) ?? "ranking";
  const period = LEADERBOARD_PERIODS.find((p) => p === sp.period) ?? "all";
  const courseId = sp.course || undefined;

  const [rows, courses] = await Promise.all([
    getLeaderboard({ sort, period, courseId }),
    db.course.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ sort, period, course: courseId ?? null, ...changes })) {
      if (v && !(k === "sort" && v === "ranking") && !(k === "period" && v === "all")) next.set(k, v);
    }
    const qs = next.toString();
    return `/leaderboard${qs ? `?${qs}` : ""}`;
  };

  const ranked = rows.filter((r) => r.rank != null);
  const unranked = rows.filter((r) => r.rank == null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Sort by">
        {LEADERBOARD_SORTS.map((s) => (
          <Link
            key={s}
            href={href({ sort: s })}
            role="tab"
            aria-selected={s === sort}
            replace
            scroll={false}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium ${
              s === sort ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"
            }`}
          >
            {SORT_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Period">
        {LEADERBOARD_PERIODS.map((p) => (
          <Link
            key={p}
            href={href({ period: p })}
            aria-current={p === period ? "true" : undefined}
            replace
            scroll={false}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
              p === period ? "border-fairway-600 bg-fairway-50 font-semibold text-fairway-700" : "border-line bg-card"
            }`}
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </div>

      <Suspense>
        <LeaderboardCourseSelect courses={courses} />
      </Suspense>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-muted">No settled matches or rounds here yet.</p>
      ) : sort === "ranking" ? (
        <>
          {ranked.length > 0 ? (
            <LeaderboardList rows={ranked} sort={sort} position={(r) => r.rank} label="Ranked golfers" />
          ) : (
            <p className="card p-6 text-center text-muted">Nobody has {MIN_MATCHES} settled matches here yet.</p>
          )}
          {unranked.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">Not ranked yet</h2>
              <p className="text-xs text-muted">Golfers need {MIN_MATCHES} settled matches to get a rank.</p>
              <LeaderboardList rows={unranked} sort={sort} position={() => null} label="Not ranked yet" />
            </section>
          )}
        </>
      ) : (
        <LeaderboardList rows={rows} sort={sort} position={(_, i) => i + 1} label="Golfers" />
      )}

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How rankings work</summary>
        <div className="mt-3 space-y-2 text-muted">
          <p>Your ranking is a 0-100 score built from settled matches. Voided and cancelled matches never count.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Win/loss, {pct(RANKING_WEIGHTS.winLoss)}.</strong> Ties count as half a win. New golfers are pulled
              toward .500 until they&apos;ve played a few.
            </li>
            <li>
              <strong>Strength of opponents, {pct(RANKING_WEIGHTS.opponentStrength)}.</strong> Beating lower handicaps
              counts more. Results against unverified golfers count {pct(UNVERIFIED_WEIGHT)}.
            </li>
            <li>
              <strong>Scoring, {pct(RANKING_WEIGHTS.scoring)}.</strong> Your best 8 of your last 20 score differentials.
            </li>
            <li>
              <strong>Wagering profit, {pct(RANKING_WEIGHTS.profit)}.</strong> What you&apos;ve won or lost, on a curve so
              one big day doesn&apos;t decide it.
            </li>
          </ul>
          <p>
            Each part is scored against everyone ranked here. You need {MIN_MATCHES} settled matches to be ranked. Filters
            change who is compared and which matches count.
          </p>
        </div>
      </details>
    </div>
  );
}
