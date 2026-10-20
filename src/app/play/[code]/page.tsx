import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GameScreen } from "@/components/GameScreen";
import { requireUser } from "@/lib/auth";
import { buildPlayView } from "@/lib/live";
import { loadMatch } from "@/lib/matchData";

export const dynamic = "force-dynamic";

export default async function PlayMatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/play/${code}`);
  const match = await loadMatch({ code });
  if (!match) notFound();
  // Spectators (and signed-in non-players) get the public scorecard.
  if (!match.players.some((p) => p.userId === user.id)) redirect(`/live/${code}`);

  if (["OPEN", "VOID", "CANCELLED"].includes(match.status)) {
    return (
      <div className="card space-y-3 p-4">
        <h1 className="text-xl font-bold">
          {match.status === "OPEN" ? "Waiting for the group" : match.status === "VOID" ? "This match is void" : "This match was cancelled"}
        </h1>
        <p className="text-sm text-muted">
          {match.status === "OPEN"
            ? "Scoring opens once every player is in and the wagers are held."
            : "Wagers were refunded. Your tee time is unaffected."}
        </p>
        <Link href="/play" className="block rounded-xl border border-line py-3 text-center font-medium">Back</Link>
      </div>
    );
  }
  const view = buildPlayView(match, user.id)!;
  return <GameScreen code={code} initial={view} />;
}
