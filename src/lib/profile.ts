// Golfer profiles and handicaps. Owned by the profiles worker; signatures are the contract.
import type { HandicapSource } from "@prisma/client";
import { db } from "./db";
import { adjustedGrossScore, handicapIndex, scoreDifferential } from "./golf/handicap";

/** Cards the golfer needs to play matches without a GHIN number. */
export const CARDS_TO_PLAY = 5;
const CARDS_USED = 20;

export const CAN_PLAY_REASON = "Add your GHIN number or your 5 most recent score cards to play matches";

export interface HandicapInputs {
  ghinNumber: string | null;
  ghinIndex: number | null;
  ghinVerified: boolean;
  cardCount: number;
  appIndex: number | null;
}

/** Which index a golfer plays off: verified GHIN, else their own app index with 5 cards, else a reported GHIN index. */
export function chooseHandicap(i: HandicapInputs): { index: number | null; source: HandicapSource } {
  const hasGhin = !!i.ghinNumber && i.ghinIndex !== null;
  if (i.ghinVerified && i.ghinIndex !== null) return { index: i.ghinIndex, source: "GHIN" };
  if (i.cardCount >= CARDS_TO_PLAY && i.appIndex !== null) return { index: i.appIndex, source: "APP" };
  if (hasGhin) return { index: i.ghinIndex, source: "GHIN" };
  return { index: null, source: "NONE" };
}

/** Verified badge: GHIN checked by an admin AND at least one round entered here. */
export function isVerified(ghinVerified: boolean, cardCount: number): boolean {
  return ghinVerified && cardCount >= 1;
}

/** Recomputes handicapIndex / handicapSource / verified for a user from their GHIN status and score cards. */
export async function recomputeHandicap(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const [cardCount, counting] = await Promise.all([
    db.scoreCard.count({ where: { userId } }),
    db.scoreCard.findMany({
      where: { userId, countsForHandicap: true },
      orderBy: { playedAt: "desc" },
      take: CARDS_USED,
      select: { differential: true },
    }),
  ]);
  const appIndex = handicapIndex(counting.map((c) => c.differential));
  const ghinVerified = user.ghinVerifiedAt !== null;
  const chosen = chooseHandicap({
    ghinNumber: user.ghinNumber,
    ghinIndex: user.ghinIndex,
    ghinVerified,
    cardCount,
    appIndex,
  });
  await db.user.update({
    where: { id: userId },
    data: { handicapIndex: chosen.index, handicapSource: chosen.source, verified: isVerified(ghinVerified, cardCount) },
  });
}

/** A golfer can book a wagered match once they have a GHIN number or 5 score cards. */
export async function canPlayMatches(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { ghinNumber: true, ghinIndex: true } });
  if (user?.ghinNumber && user.ghinIndex !== null) return { ok: true };
  const cards = await db.scoreCard.count({ where: { userId } });
  if (cards >= CARDS_TO_PLAY) return { ok: true };
  return { ok: false, reason: CAN_PLAY_REASON };
}

/**
 * After a match is over: saves each player's round as a MATCH score card and recomputes handicaps.
 * VOID matches (no opponent) are skipped here; the golfer enters that round as a normal card.
 */
export async function addMatchScoreCards(matchId: string): Promise<void> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      players: true,
      scores: true,
      teeSet: true,
      teeTime: true,
      course: { include: { holes: { orderBy: { number: "asc" } } } },
    },
  });
  if (!match || (match.status !== "SETTLED" && match.status !== "CONFIRMING")) return;
  const holes = match.course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex }));
  if (holes.length !== 18) return;

  for (const p of match.players) {
    const strokes: number[] = [];
    for (let n = 1; n <= 18; n++) {
      const s = match.scores.find((x) => x.userId === p.userId && x.holeNumber === n);
      if (s) strokes.push(s.strokes);
    }
    if (strokes.length !== 18) continue;
    const existing = await db.scoreCard.findFirst({ where: { matchId, userId: p.userId }, select: { id: true } });
    if (!existing) {
      const adjustedGross = adjustedGrossScore(strokes, holes, p.courseHandicap);
      await db.scoreCard.create({
        data: {
          userId: p.userId,
          courseId: match.courseId,
          teeSetId: match.teeSetId,
          playedAt: match.teeTime.startsAt,
          holeStrokes: JSON.stringify(strokes),
          grossScore: strokes.reduce((a, b) => a + b, 0),
          adjustedGross,
          differential: scoreDifferential(adjustedGross, match.teeSet),
          source: "MATCH",
          matchId,
        },
      });
    }
    await recomputeHandicap(p.userId);
  }
}
