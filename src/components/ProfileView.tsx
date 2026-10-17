import Link from "next/link";
import { FORMAT_LABEL } from "@/lib/matchData";
import { formatCents } from "@/lib/money";
import type { LoadedProfile } from "@/lib/profileData";
import { resultText } from "@/lib/stats";
import { formatTeeDate } from "@/lib/time";
import { HandicapSourceTag, VerifiedBadge } from "./VerifiedBadge";
import { WeatherBadge } from "./WeatherBadge";
import { ProfileSparkline } from "./ProfileSparkline";
import { ScoreCardDeleteButton } from "./ScoreCardDeleteButton";

const SOURCE_NOTE = {
  GHIN: "From GHIN",
  APP: "Calculated from rounds entered here",
  NONE: "Add a GHIN number or 5 rounds",
} as const;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  );
}

/** Profile body shared by /profile (own) and /golfers/[id] (public). `own` shows the delete controls. */
export function ProfileView({ profile, own = false }: { profile: LoadedProfile; own?: boolean }) {
  const { user, stats, ranking, record, history, courses, trend, cards } = profile;
  const hasGhin = !!user.ghinNumber;
  const index = user.handicapIndex === null ? "–" : user.handicapIndex < 0 ? `+${Math.abs(user.handicapIndex)}` : user.handicapIndex.toFixed(1);
  const decided = record.wins + record.losses + record.ties;

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          {user.verified ? <VerifiedBadge /> : <HandicapSourceTag source={user.handicapSource} hasGhin={hasGhin} />}
        </div>
        {user.verified && <p className="text-sm text-muted">GHIN checked and rounds entered here.</p>}
        {profile.homeCourseName && <p className="text-sm text-muted">Home course: {profile.homeCourseName}{user.state ? `, ${user.state}` : ""}</p>}
        <div className="flex items-end justify-between border-t border-line pt-3">
          <div>
            <p className="text-xs text-muted">Handicap Index</p>
            <p className="text-3xl font-bold" data-testid="handicap-index">{index}</p>
            <p className="text-xs text-muted">{SOURCE_NOTE[user.handicapSource]}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Ranking</p>
            {ranking.rank === null ? (
              <p className="text-base font-semibold text-muted">Not ranked yet</p>
            ) : (
              <p className="text-3xl font-bold">#{ranking.rank}</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Scoring</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Rounds" value={stats.rounds} />
          <Stat label="Scoring average" value={stats.scoringAverage ?? "–"} />
          <Stat label="Best round" value={stats.bestRound ?? "–"} />
          <Stat label="Average differential" value={stats.averageDifferential ?? "–"} />
        </div>
        <div className="card p-3">
          <p className="mb-1 text-xs text-muted">Differential trend (last {Math.min(trend.length, 20)} rounds)</p>
          <ProfileSparkline values={trend} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Match record</h2>
        <div className="card flex items-center justify-between p-4">
          <p className="text-2xl font-bold" data-testid="match-record">
            {record.wins}-{record.losses}-{record.ties}
          </p>
          <p className="text-sm text-muted">{decided === 0 ? "No settled matches yet" : "Wins-losses-ties"}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Courses played ({courses.length})</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted">No rounds yet.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {courses.map((c) => (
              <li key={c.courseId} className="flex justify-between px-4 py-3 text-sm">
                <span>{c.name}</span>
                <span className="text-muted">{c.rounds} {c.rounds === 1 ? "round" : "rounds"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Competition history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No finished matches yet.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {history.map((h) => (
              <li key={h.matchId} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <Link href={`/live/${h.code}`} className="font-medium">{h.courseName}</Link>
                  <span className={h.status === "VOID" ? "text-muted" : (h.resultCents ?? 0) > 0 ? "font-semibold text-fairway-600" : (h.resultCents ?? 0) < 0 ? "font-semibold text-flame" : "text-muted"}>
                    {h.status === "VOID" ? "Void, refunded" : resultText(h.resultCents, formatCents)}
                  </span>
                </div>
                <p className="text-muted">{formatTeeDate(h.startsAt, h.timezone)} · {FORMAT_LABEL[h.format as keyof typeof FORMAT_LABEL] ?? h.format}</p>
                <WeatherBadge conditions={h.conditions} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Score cards</h2>
          {own && <Link href="/scorecards/new" className="text-sm font-medium text-fairway-600">Add a round</Link>}
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">No score cards yet.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {cards.slice(0, own ? 30 : 10).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{c.course.name}</p>
                  <p className="text-muted">
                    {formatTeeDate(c.playedAt, c.course.timezone)} · {c.teeSet.name} tees · diff {c.differential.toFixed(1)}
                    {c.source === "MATCH" ? " · from match" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lg font-bold">{c.grossScore}</span>
                  {own && c.source === "MANUAL" && <ScoreCardDeleteButton id={c.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
