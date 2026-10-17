import Link from "next/link";
import { db } from "@/lib/db";
import { FORMAT_LABEL } from "@/lib/matchData";
import { formatTeeDate, formatTeeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_WORDS: Record<string, string> = { LIVE: "Live", CONFIRMING: "Final, confirming", SETTLED: "Final", DISPUTED: "Final, disputed" };

export default async function LivePage() {
  const since = new Date(Date.now() - 48 * 3_600_000);
  const matches = await db.match.findMany({
    where: {
      OR: [
        { status: { in: ["LIVE", "CONFIRMING"] } },
        { status: "READY", scores: { some: {} } },
        { status: { in: ["SETTLED", "DISPUTED"] }, OR: [{ finishedAt: { gte: since } }, { settledAt: { gte: since } }] },
      ],
    },
    include: {
      course: true,
      teeTime: true,
      players: { include: { user: true }, orderBy: [{ side: "asc" }, { joinedAt: "asc" }] },
      scores: { select: { holeNumber: true } },
    },
    orderBy: { teeTime: { startsAt: "desc" } },
    take: 50,
  });
  const live = matches.filter((m) => m.status === "LIVE" || m.status === "READY");
  const rest = matches.filter((m) => m.status !== "LIVE" && m.status !== "READY");

  const row = (m: (typeof matches)[number]) => {
    const perHole = new Map<number, number>();
    for (const s of m.scores) perHole.set(s.holeNumber, (perHole.get(s.holeNumber) ?? 0) + 1);
    const thru = [...perHole.values()].filter((n) => n >= m.players.length).length;
    return (
      <li key={m.id}>
        <Link href={`/live/${m.code}`} className="card block space-y-1 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className={`rounded-full px-2 py-0.5 font-bold ${m.status === "LIVE" || m.status === "READY" ? "bg-flame text-white" : "bg-fairway-100 text-fairway-900"}`}>
              {m.status === "LIVE" || m.status === "READY" ? "● LIVE" : STATUS_WORDS[m.status]}
            </span>
            <span className="text-muted">
              {thru > 0 ? `Thru ${thru}` : `${formatTeeDate(m.teeTime.startsAt, m.course.timezone)} ${formatTeeTime(m.teeTime.startsAt, m.course.timezone)}`}
            </span>
          </div>
          <p className="text-lg font-bold">{m.players.map((p) => p.user.name.split(" ")[0]).join(" · ")}</p>
          <p className="text-sm text-muted">{m.course.name} · {FORMAT_LABEL[m.format]}</p>
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Live scorecards</h1>
      <p className="text-sm text-muted">Anyone can watch. No account needed.</p>
      <section className="space-y-3">
        <h2 className="font-semibold">On the course now</h2>
        {live.length === 0 ? <p className="card p-4 text-sm text-muted">Nobody is playing right now.</p> : <ul className="space-y-3">{live.map(row)}</ul>}
      </section>
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Recently finished</h2>
          <ul className="space-y-3">{rest.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
