// Loads a match from the database into the pure input the golf logic works on.
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { MatchScoringInput } from "./golf/types";

export const matchInclude = {
  players: { include: { user: true }, orderBy: [{ side: "asc" as const }, { joinedAt: "asc" as const }] },
  scores: true,
  presses: { orderBy: { createdAt: "asc" as const } },
  course: { include: { holes: { orderBy: { number: "asc" as const } } } },
  teeSet: true,
  teeTime: true,
} satisfies Prisma.MatchInclude;

export async function loadMatch(where: { id: string } | { code: string }) {
  return db.match.findUnique({ where, include: matchInclude });
}

export type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

export function toScoringInput(match: LoadedMatch): MatchScoringInput {
  const gross: MatchScoringInput["gross"] = {};
  const strokes: MatchScoringInput["strokes"] = {};
  for (const p of match.players) {
    gross[p.userId] = Array(18).fill(null);
    strokes[p.userId] = p.strokesReceived ? (JSON.parse(p.strokesReceived) as number[]) : Array(18).fill(0);
  }
  for (const s of match.scores) {
    if (gross[s.userId] && s.holeNumber >= 1 && s.holeNumber <= 18) gross[s.userId][s.holeNumber - 1] = s.strokes;
  }
  return {
    format: match.format,
    scoring: match.scoring,
    holes: match.course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex })),
    players: match.players.map((p) => ({ id: p.userId, side: p.side })),
    strokes,
    gross,
    presses: match.presses.map((p) => ({ side: p.side, opponentSide: p.opponentSide, holeNumber: p.holeNumber })),
    stakeCents: match.stakeCents,
    pointValueCents: match.pointValueCents,
  };
}

/** Players per format, and how many sides. */
export const FORMAT_SIZE: Record<MatchScoringInput["format"], { players: number; sides: number }> = {
  SINGLES_STROKE: { players: 2, sides: 2 },
  SINGLES_MATCH: { players: 2, sides: 2 },
  FOURBALL_STROKE: { players: 4, sides: 2 },
  FOURBALL_MATCH: { players: 4, sides: 2 },
  NINE_POINT: { players: 3, sides: 3 },
  THREESOME_STROKE: { players: 3, sides: 3 },
  THREESOME_MATCH: { players: 3, sides: 3 },
};

export const FORMAT_LABEL: Record<MatchScoringInput["format"], string> = {
  SINGLES_STROKE: "1v1 stroke play",
  SINGLES_MATCH: "1v1 match play",
  FOURBALL_STROKE: "2v2 best ball stroke play",
  FOURBALL_MATCH: "2v2 best ball match play",
  NINE_POINT: "Nine point game",
  THREESOME_STROKE: "Threesome, stroke play matches",
  THREESOME_MATCH: "Threesome, match play matches",
};

export const MIN_STAKE_CENTS = 2000;
