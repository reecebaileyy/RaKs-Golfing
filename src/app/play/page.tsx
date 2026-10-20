import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABEL } from "@/lib/matchData";
import { formatTeeDate, formatTeeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await requireUser("/play");
  const matches = await db.match.findMany({
    where: { status: { in: ["READY", "LIVE", "CONFIRMING", "DISPUTED"] }, players: { some: { userId: user.id } } },
    include: { course: true, teeTime: true, players: { include: { user: true }, orderBy: [{ side: "asc" }, { joinedAt: "asc" }] } },
    orderBy: { teeTime: { startsAt: "asc" } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Game screen</h1>
      {matches.length === 0 ? (
        <div className="card space-y-3 p-4">
          <p>You don&apos;t have a round to play right now.</p>
          <p className="text-sm text-muted">Once your match is ready (everyone in and paid), it shows up here.</p>
          <Link href="/" className="block rounded-xl bg-fairway-700 py-3 text-center font-semibold text-white">Book a tee time</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li key={m.id} className="card space-y-3 p-4">
              <div>
                <p className="text-lg font-bold">{m.course.name}</p>
                <p className="text-sm text-muted">
                  {formatTeeDate(m.teeTime.startsAt, m.course.timezone)} · {formatTeeTime(m.teeTime.startsAt, m.course.timezone)} · {FORMAT_LABEL[m.format]}
                </p>
                <p className="mt-1 text-sm">{m.players.map((p) => p.user.name.split(" ")[0]).join(" · ")}</p>
              </div>
              <Link href={`/play/${m.code}`} className="block rounded-xl bg-fairway-700 py-4 text-center text-lg font-bold text-white">
                {m.status === "LIVE" ? "Back to the round" : m.status === "READY" ? "Start round" : "Open card"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
