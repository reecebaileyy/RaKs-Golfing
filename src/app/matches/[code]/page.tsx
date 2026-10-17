import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FORMAT_LABEL, FORMAT_SIZE } from "@/lib/matchData";
import { formatCents } from "@/lib/money";
import { canPlayMatches } from "@/lib/profile";
import { formatTeeDate, formatTeeTime } from "@/lib/time";
import { getMatch, openSlots, sideCapacity, sideLabel, SWEEP_HOURS, sweepMatches, wagerHoldCents } from "@/lib/wagers/matches";
import { MatchActionButton } from "@/components/MatchActionButton";
import { MatchInviteLink } from "@/components/MatchInviteLink";
import { MatchJoinForm } from "@/components/MatchJoinForm";
import { STATUS_LABEL, stakeLine } from "@/components/MatchCard";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default async function MatchLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await sweepMatches();
  const [match, user] = await Promise.all([getMatch(code), getCurrentUser()]);
  if (!match) notFound();

  const tz = match.course.timezone;
  const size = FORMAT_SIZE[match.format];
  const me = user ? match.players.find((p) => p.userId === user.id) : undefined;
  const slots = openSlots(match.format, match.players);
  const holdCents = wagerHoldCents(match.format, match.stakeCents);
  const tooLate = match.teeTime.startsAt.getTime() - Date.now() <= SWEEP_HOURS * 3_600_000;
  const canJoin = match.status === "OPEN" && !me && slots.length > 0 && !tooLate;
  const eligible = canJoin && user ? await canPlayMatches(user.id) : { ok: true };
  const inPlay = ["READY", "LIVE", "CONFIRMING", "DISPUTED"].includes(match.status);
  const title = `${FORMAT_LABEL[match.format]} at ${match.course.name}`;
  const terms = `${FORMAT_LABEL[match.format].toLowerCase()}, ${match.scoring === "NET" ? "net" : "gross"}, ${
    match.format === "NINE_POINT" ? `points voted by the group, losses capped at ${formatCents(match.stakeCents)}` : `${formatCents(match.stakeCents)} a player`
  }`;

  const sides = Array.from({ length: size.sides }, (_, side) => ({
    side,
    label: sideLabel(match.format, side),
    players: match.players.filter((p) => p.side === side),
    open: sideCapacity(match.format) - match.players.filter((p) => p.side === side).length,
  }));

  return (
    <div className="space-y-5">
      <Link href="/matches" className="text-sm text-fairway-600">← Matches</Link>

      <div className="rounded-2xl bg-fairway-700 p-5 text-white">
        <p className="text-sm opacity-80" data-testid="match-status">{STATUS_LABEL[match.status]}</p>
        <h1 className="text-2xl font-bold">{match.course.name}</h1>
        <p className="mt-1 text-lg">
          {formatTeeDate(match.teeTime.startsAt, tz)} · {formatTeeTime(match.teeTime.startsAt, tz)}
        </p>
        <p className="mt-2 text-sm">{stakeLine(match)}</p>
        <p className="mt-3 text-sm opacity-80">Match code</p>
        <p data-testid="match-code" className="font-mono text-xl tracking-widest">{match.code}</p>
      </div>

      {inPlay && (
        <Link href={`/play/${match.code}`} className="block rounded-xl bg-flame py-4 text-center text-lg font-semibold text-white">Go to game</Link>
      )}

      <section className="card p-4 text-sm">
        <Row label="Format" value={FORMAT_LABEL[match.format]} />
        <Row label="Scoring" value={match.scoring === "NET" ? "Net (handicap strokes)" : "Gross"} />
        {match.format === "NINE_POINT" ? (
          <>
            <Row label="Per point" value={match.pointValueCents ? formatCents(match.pointValueCents) : "Group vote"} />
            <Row label="Loss cap" value={formatCents(match.stakeCents)} />
          </>
        ) : (
          <Row label="Wager" value={`${formatCents(match.stakeCents)} a player${size.sides === 3 ? ", per opponent" : ""}`} />
        )}
        <Row label="Tees" value={`${match.teeSet.name} (${match.teeSet.courseRating.toFixed(1)} / ${match.teeSet.slope})`} />
        <Row label="Held from each player" value={formatCents(holdCents)} />
        {match.isOpenChallenge && <Row label="Open challenge" value="Anyone can join" />}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Players</h2>
        <div className={`grid gap-2 ${size.sides === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {sides.map((s) => (
            <div key={s.side} className="card p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
              <ul className="space-y-2">
                {s.players.map((p) => {
                  const index = p.handicapIndex ?? p.user.handicapIndex;
                  const verified = match.readyAt ? p.verifiedAtStart : p.user.verified;
                  return (
                    <li key={p.id} data-testid="match-player">
                      <p className="font-semibold">
                        {p.user.name}
                        {verified && <span className="ml-1 rounded-full bg-fairway-100 px-2 py-0.5 text-[11px] font-semibold text-fairway-900">Verified</span>}
                      </p>
                      <p className="text-xs text-muted">
                        Index {index ?? "none yet"}
                        {p.playingHandicap !== null && match.scoring === "NET" && ` · plays off ${p.playingHandicap}`}
                        {typeof p.resultCents === "number" && ` · ${p.resultCents > 0 ? "+" : ""}${formatCents(p.resultCents)}`}
                      </p>
                    </li>
                  );
                })}
                {Array.from({ length: s.open }, (_, i) => (
                  <li key={`open-${i}`} className="text-sm text-muted">Open spot</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {match.status === "OPEN" && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Invite friends</h2>
          <p className="text-sm text-muted">
            Anyone with this link can see the match and join. If it isn&apos;t full {SWEEP_HOURS} hours before the tee time, every wager is
            refunded and the tee time is kept.
          </p>
          <MatchInviteLink code={match.code} title={title} />
        </section>
      )}

      {canJoin && !user && (
        <Link href={`/signin?next=${encodeURIComponent(`/matches/${match.code}`)}`} className="block rounded-xl bg-fairway-700 py-4 text-center font-semibold text-white">
          Sign in to join
        </Link>
      )}
      {canJoin && user && !eligible.ok && (
        <div className="card p-4 text-center text-sm">
          <p className="font-semibold">Set up your handicap to join</p>
          <p className="mt-1 text-muted">{eligible.reason}</p>
          <Link href={`/onboarding?next=${encodeURIComponent(`/matches/${match.code}`)}`} className="mt-2 inline-block font-medium text-fairway-600">Set up my profile</Link>
        </div>
      )}
      {canJoin && user && eligible.ok && (
        <MatchJoinForm
          code={match.code}
          holdCents={holdCents}
          ninePoint={match.format === "NINE_POINT"}
          terms={terms}
          sides={[...new Set(slots)].map((side) => ({
            side,
            label: sideLabel(match.format, side),
            with: match.players.filter((p) => p.side === side).map((p) => p.user.name),
          }))}
        />
      )}

      {me && match.status === "OPEN" && (
        <p className="rounded-xl bg-fairway-50 p-3 text-sm text-fairway-900">
          You&apos;re in. {formatCents(me.heldCents)} is held for this match.
        </p>
      )}
      {me && match.status === "OPEN" && match.createdById !== me.userId && (
        <MatchActionButton
          url={`/api/matches/${match.code}/leave`}
          label="Leave match"
          confirmText={`You'll get your ${formatCents(me.heldCents)} wager back in full.`}
          confirmLabel="Yes, leave"
          tone="danger"
        />
      )}
      {me && match.createdById === me.userId && match.reservation && ["OPEN", "READY"].includes(match.status) && (
        <Link href={`/reservations/${match.reservation.confirmationCode}`} className="block text-center text-sm font-medium text-fairway-600">
          Your booking ({match.reservation.confirmationCode})
        </Link>
      )}

      {(match.status === "VOID" || match.status === "CANCELLED") && (
        <p className="card p-4 text-sm text-muted">
          {match.status === "VOID" ? "Nobody else joined in time, so every wager was refunded. The tee time is still booked." : "The booking was cancelled and every wager was refunded."}
        </p>
      )}

      {match.status === "DISPUTED" && (
        <section className="card space-y-2 p-4 text-sm">
          <h2 className="font-semibold">Card disputed</h2>
          <p className="text-muted">The money stays held while we review the card.</p>
          {match.players.filter((p) => p.disputeReason).map((p) => (
            <p key={p.id}>
              <span className="font-medium">{p.user.name}:</span> {p.disputeReason}
            </p>
          ))}
        </section>
      )}

      {user?.isAdmin && match.status === "DISPUTED" && (
        <section className="space-y-2 rounded-2xl border-2 border-dashed border-line p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Admin</h2>
          <MatchActionButton
            url={`/api/matches/${match.code}`}
            body={{ action: "resolve", resolution: "settle" }}
            label="Settle on the current card"
            confirmText="Pay out using the scores as they are now. Fix any wrong scores first."
            confirmLabel="Settle"
            tone="primary"
          />
          <MatchActionButton
            url={`/api/matches/${match.code}`}
            body={{ action: "resolve", resolution: "refund" }}
            label="Void and refund everyone"
            confirmText="Every player gets everything they had held back, presses included."
            confirmLabel="Refund all"
            tone="danger"
          />
        </section>
      )}
    </div>
  );
}
