import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listMyMatches, listOpenChallenges, matchPhase, openSlots, sweepMatches } from "@/lib/wagers/matches";
import { MatchCard } from "@/components/MatchCard";

export const dynamic = "force-dynamic";

function Section({ title, empty, children }: { title: string; empty?: string | false; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {empty ? <p className="card p-4 text-center text-sm text-muted">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

export default async function MatchesPage() {
  await sweepMatches();
  const user = await getCurrentUser();
  const [mine, open] = await Promise.all([user ? listMyMatches(user.id) : [], listOpenChallenges(user?.id ?? null)]);
  const live = mine.filter((m) => matchPhase(m.status) === "live");
  const upcoming = mine.filter((m) => matchPhase(m.status) === "upcoming");
  const finished = mine.filter((m) => matchPhase(m.status) === "finished").reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <Link href="/reservations" className="text-sm font-medium text-fairway-600">My tee times</Link>
      </div>

      {!user && (
        <div className="card p-4 text-sm">
          <p className="font-semibold">Sign in to see your matches.</p>
          <Link href="/signin?next=/matches" className="mt-2 inline-block font-medium text-fairway-600">Sign in</Link>
        </div>
      )}

      {user && live.length > 0 && (
        <Section title="Live">
          {live.map((m) => <li key={m.id}><MatchCard match={m} userId={user.id} /></li>)}
        </Section>
      )}

      {user && (
        <Section title="Upcoming" empty={upcoming.length === 0 && "No upcoming matches. Book a tee time to start one, or join a challenge below."}>
          {upcoming.map((m) => <li key={m.id}><MatchCard match={m} userId={user.id} /></li>)}
        </Section>
      )}

      <Section title="Open challenges" empty={open.length === 0 && "No open challenges right now."}>
        {open.map((m) => (
          <li key={m.id}>
            <MatchCard match={m} />
            <p className="mt-1 px-1 text-xs text-muted">{openSlots(m.format, m.players).length} spot{openSlots(m.format, m.players).length === 1 ? "" : "s"} open</p>
          </li>
        ))}
      </Section>

      {user && finished.length > 0 && (
        <Section title="Finished">
          {finished.map((m) => <li key={m.id}><MatchCard match={m} userId={user.id} /></li>)}
        </Section>
      )}

      <Link href="/" className="block rounded-xl bg-fairway-700 py-4 text-center font-semibold text-white">Book a tee time and start a match</Link>
    </div>
  );
}
