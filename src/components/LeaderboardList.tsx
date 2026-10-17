import Link from "next/link";
import { formatCents } from "@/lib/money";
import type { LeaderboardRow, LeaderboardSort } from "@/lib/ranking";
import { LeaderboardVerifiedBadge } from "./LeaderboardVerifiedBadge";

function headline(row: LeaderboardRow, sort: LeaderboardSort): { value: string; label: string } {
  switch (sort) {
    case "ranking":
      return { value: row.score == null ? "—" : row.score.toFixed(1), label: "score" };
    case "scoring":
      return { value: row.scoringAverage == null ? "—" : row.scoringAverage.toFixed(1), label: "avg" };
    case "matches":
      return { value: record(row), label: "W-L-T" };
    case "earnings":
      return { value: formatCents(row.earningsCents), label: "won" };
  }
}

function record(row: LeaderboardRow) {
  return `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`;
}

function Earnings({ cents }: { cents: number }) {
  const color = cents > 0 ? "text-fairway-600" : cents < 0 ? "text-red-600" : "text-muted";
  return <span className={color}>{cents > 0 ? "+" : ""}{formatCents(cents)}</span>;
}

/** One list of golfers; `position` is the number shown at the left (null shows a dash). */
export function LeaderboardList({
  rows,
  sort,
  position,
  label,
}: {
  rows: LeaderboardRow[];
  sort: LeaderboardSort;
  position: (row: LeaderboardRow, i: number) => number | null;
  label: string;
}) {
  return (
    <ol className="card divide-y divide-[var(--line)] overflow-hidden" aria-label={label}>
      {rows.map((row, i) => {
        const pos = position(row, i);
        const h = headline(row, sort);
        return (
          <li key={row.userId} data-testid="leaderboard-row">
            <Link href={`/golfers/${row.userId}`} className="flex items-center gap-3 px-4 py-3 active:bg-fairway-50">
              <span className="w-6 shrink-0 text-center text-lg font-bold text-muted">{pos ?? "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{row.user.name}</span>
                  {row.user.verified && <LeaderboardVerifiedBadge />}
                </span>
                <span className="block text-sm text-muted">
                  {record(row)} · <Earnings cents={row.earningsCents} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg font-bold tabular-nums" data-testid="leaderboard-headline">{h.value}</span>
                <span className="block text-xs text-muted">{h.label}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
