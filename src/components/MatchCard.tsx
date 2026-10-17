import Link from "next/link";
import { FORMAT_LABEL } from "@/lib/matchData";
import { formatCents } from "@/lib/money";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import type { listMyMatches } from "@/lib/wagers/matches";

type ListedMatch = Awaited<ReturnType<typeof listMyMatches>>[number];

export const STATUS_LABEL: Record<ListedMatch["status"], string> = {
  OPEN: "Waiting for players",
  READY: "Ready",
  LIVE: "Live",
  CONFIRMING: "Confirm the card",
  SETTLED: "Settled",
  DISPUTED: "In review",
  VOID: "Void: refunded",
  CANCELLED: "Cancelled: refunded",
};

export function stakeLine(m: { format: ListedMatch["format"]; scoring: string; stakeCents: number; pointValueCents?: number | null }) {
  const money =
    m.format === "NINE_POINT"
      ? `${m.pointValueCents ? `${formatCents(m.pointValueCents)}/pt, ` : ""}cap ${formatCents(m.stakeCents)}`
      : formatCents(m.stakeCents);
  return `${FORMAT_LABEL[m.format]} · ${m.scoring === "NET" ? "Net" : "Gross"} · ${money}`;
}

/** One match in a list: where, when, what for, and how it stands. */
export function MatchCard({ match, userId }: { match: ListedMatch; userId?: string | null }) {
  const tz = match.course.timezone;
  const me = userId ? match.players.find((p) => p.userId === userId) : undefined;
  const result = me?.resultCents;
  return (
    <Link href={`/matches/${match.code}`} className="card block p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{match.course.name}</p>
          <p className="text-sm text-muted">
            {formatTeeDate(match.teeTime.startsAt, tz)} · {formatTeeTime(match.teeTime.startsAt, tz)}
          </p>
          <p className="text-sm">{stakeLine(match)}</p>
          <p className="truncate text-xs text-muted">{match.players.map((p) => p.user.name).join(", ")}</p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <span className={match.status === "LIVE" ? "font-semibold text-flame" : "text-fairway-600"}>{STATUS_LABEL[match.status]}</span>
          {typeof result === "number" && match.status === "SETTLED" && (
            <span className={`block font-semibold ${result > 0 ? "text-fairway-700" : result < 0 ? "text-red-700" : "text-muted"}`}>
              {result > 0 ? "+" : ""}
              {formatCents(result)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
