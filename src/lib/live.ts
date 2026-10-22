// Live scoring: the public scorecard view, the player's game-screen view, and writing hole scores.
// Score math lives in src/lib/golf and money moments in src/lib/wagers/round.ts; this file only
// shapes their output for the screens. When the math throws (or isn't there yet) scores still show.

import { z } from "zod";
import { AppError } from "./api";
import { db } from "./db";
import { computeMatchState, pressEligibility } from "./golf";
import type { MatchScoringInput, MatchState, PairingState } from "./golf/types";
import { FORMAT_LABEL, loadMatch, toScoringInput, type LoadedMatch } from "./matchData";
import { onScoresChanged } from "./wagers/round";

export const MAX_STROKES = 15;

const SIDE_LETTERS = ["A", "B", "C"];

export interface LivePlayer {
  userId: string;
  name: string;
  side: number;
  /** Handicap strokes received on each hole. */
  strokesReceived: number[];
  gross: (number | null)[];
  /** Gross minus handicap strokes on NET matches, same as gross on GROSS matches. */
  net: (number | null)[];
  grossTotal: number;
  netTotal: number;
  holesPlayed: number;
}

export interface LivePairing {
  /** Side names, e.g. "Reece & Maya" vs "Jordan". */
  names: [string, string];
  summary: string;
  closedOut: boolean;
  winnerSide: number | null | undefined;
}

export interface LiveView {
  code: string;
  status: string;
  format: string;
  formatLabel: string;
  scoring: "NET" | "GROSS";
  course: { name: string; city: string };
  startsAt: string;
  holes: { number: number; par: number; strokeIndex: number; yards: number | null }[];
  players: LivePlayer[];
  sideNames: string[];
  /** Holes where every player has a score. */
  holesCompleted: number;
  /** Null when the golf math couldn't run: show scores only. */
  pairings: LivePairing[] | null;
  ninePoint: { name: string; points: number }[] | null;
  presses: { callerSide: string; opponentSide: string; holeNumber: number; outcome: string | null }[];
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function sideNames(match: Pick<LoadedMatch, "players">): string[] {
  const bySide = new Map<number, string[]>();
  for (const p of match.players) bySide.set(p.side, [...(bySide.get(p.side) ?? []), firstName(p.user.name)]);
  const out: string[] = [];
  for (const [side, names] of [...bySide.entries()].sort((a, b) => a[0] - b[0])) out[side] = names.join(" & ");
  return out;
}

/** Swaps "Side A/B/C" in the golf logic's status text for real names. */
export function nameSummary(summary: string, names: string[]): string {
  return summary.replace(/Side ([ABC])/g, (whole, letter: string) => names[SIDE_LETTERS.indexOf(letter)] ?? whole);
}

function toLivePairing(p: PairingState, names: string[]): LivePairing {
  return {
    names: [names[p.sides[0]] ?? "?", names[p.sides[1]] ?? "?"],
    summary: nameSummary(p.summary, names),
    closedOut: p.closedOut,
    winnerSide: p.winnerSide,
  };
}

/** Pure: the public view of a match given the loaded rows and (when available) the computed state. */
export function buildLiveView(match: LoadedMatch, state: MatchState | null): LiveView {
  const input = toScoringInput(match);
  const names = sideNames(match);
  const nameOf = (userId: string) => firstName(match.players.find((p) => p.userId === userId)?.user.name ?? "?");

  const players: LivePlayer[] = match.players.map((p) => {
    const gross = input.gross[p.userId];
    const strokes = input.strokes[p.userId];
    const net = gross.map((g, i) => (g == null ? null : match.scoring === "NET" ? g - (strokes[i] ?? 0) : g));
    const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
    return {
      userId: p.userId,
      name: p.user.name,
      side: p.side,
      strokesReceived: strokes,
      gross,
      net,
      grossTotal: sum(gross),
      netTotal: sum(net),
      holesPlayed: gross.filter((g) => g != null).length,
    };
  });

  let holesCompleted = 0;
  for (let i = 0; i < 18; i++) {
    if (players.length > 0 && players.every((p) => p.gross[i] != null)) holesCompleted = i + 1;
    else break;
  }

  return {
    code: match.code,
    status: match.status,
    format: match.format,
    formatLabel: FORMAT_LABEL[match.format],
    scoring: match.scoring,
    course: { name: match.course.name, city: match.course.city },
    startsAt: match.teeTime.startsAt.toISOString(),
    holes: match.course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex, yards: h.yards })),
    players,
    sideNames: names,
    holesCompleted,
    pairings: state ? state.pairings.map((p) => toLivePairing(p, names)) : null,
    ninePoint: state?.ninePoint
      ? Object.entries(state.ninePoint.totals).map(([userId, points]) => ({ name: nameOf(userId), points }))
      : null,
    presses: match.presses.map((p) => ({
      callerSide: names[p.side] ?? "?",
      opponentSide: names[p.opponentSide] ?? "?",
      holeNumber: p.holeNumber,
      outcome: p.outcome,
    })),
  };
}

function safeState(input: MatchScoringInput): MatchState | null {
  try {
    return computeMatchState(input);
  } catch {
    return null;
  }
}

export function viewFromMatch(match: LoadedMatch): LiveView {
  return buildLiveView(match, safeState(toScoringInput(match)));
}

/** Public view by short code, or null when there is no such match. Never includes emails or money. */
export async function getLiveView(code: string): Promise<LiveView | null> {
  const match = await loadMatch({ code });
  return match ? viewFromMatch(match) : null;
}

// ---------------------------------------------------------------------------------------------
// The game screen (players only)
// ---------------------------------------------------------------------------------------------

export interface PressOption {
  opponentSide: number;
  opponentName: string;
  eligible: boolean;
  reason?: string;
  holes: number[];
  /** Extra money held now from each player on the pressing side. */
  holdCentsEach: number;
  /** What the pressing side pays if it loses the pressed hole. */
  loseCents: number;
}

export interface PlayView extends LiveView {
  me: { userId: string; side: number; confirmed: boolean; disputed: boolean };
  geo: { number: number; teeLat: number | null; teeLng: number | null; greenLat: number | null; greenLng: number | null }[];
  courseLocation: { lat: number; lng: number; geofenceMeters: number };
  stakeCents: number;
  pointValueCents: number | null;
  pressOptions: PressOption[];
  money: { userId: string; name: string; heldCents: number; resultCents: number | null; confirmed: boolean; disputed: boolean; disputeReason: string | null }[];
}

function pressOptions(match: LoadedMatch, state: MatchState | null, side: number, names: string[]): PressOption[] {
  if (!state || match.format === "NINE_POINT" || (match.status !== "LIVE" && match.status !== "READY")) return [];
  const input = toScoringInput(match);
  const out: PressOption[] = [];
  const opponents = [...new Set(match.players.map((p) => p.side))].filter((s) => s !== side);
  for (const opponentSide of opponents) {
    if (match.presses.some((p) => p.side === side && p.opponentSide === opponentSide)) continue;
    try {
      const e = pressEligibility(input, state, side, opponentSide);
      out.push({
        opponentSide,
        opponentName: names[opponentSide] ?? "?",
        eligible: e.eligible,
        reason: e.reason,
        holes: e.holes,
        holdCentsEach: match.stakeCents,
        loseCents: match.stakeCents * 2,
      });
    } catch {
      // Golf math unavailable: no press button.
    }
  }
  return out;
}

export function buildPlayView(match: LoadedMatch, userId: string): PlayView | null {
  const me = match.players.find((p) => p.userId === userId);
  if (!me) return null;
  const state = safeState(toScoringInput(match));
  const view = buildLiveView(match, state);
  return {
    ...view,
    me: { userId, side: me.side, confirmed: !!me.confirmedAt, disputed: !!me.disputedAt },
    geo: match.course.holes.map((h) => ({ number: h.number, teeLat: h.teeLat, teeLng: h.teeLng, greenLat: h.greenLat, greenLng: h.greenLng })),
    courseLocation: { lat: match.course.latitude, lng: match.course.longitude, geofenceMeters: match.course.geofenceMeters },
    stakeCents: match.stakeCents,
    pointValueCents: match.pointValueCents,
    pressOptions: pressOptions(match, state, me.side, view.sideNames),
    money: match.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      heldCents: p.heldCents,
      resultCents: p.resultCents,
      confirmed: !!p.confirmedAt,
      disputed: !!p.disputedAt,
      disputeReason: p.disputeReason,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Writing scores
// ---------------------------------------------------------------------------------------------

export const scoresBody = z.object({
  holeNumber: z.number().int().min(1).max(18),
  scores: z
    .array(z.object({ userId: z.string().min(1), strokes: z.number().int().min(1, "Strokes are 1 to 15.").max(MAX_STROKES, "Strokes are 1 to 15.") }))
    .min(1),
});

const SCORING_STATUSES: string[] = ["READY", "LIVE", "CONFIRMING"];
const CARD_CLOSED = "This card is closed. Scores can't change now.";

/** Saves one hole for any of the match's players. Any player in the group may enter anyone's strokes. */
export async function recordHoleScores(input: {
  matchId: string;
  enteredById: string;
  holeNumber: number;
  scores: { userId: string; strokes: number }[];
}): Promise<void> {
  const match = await db.match.findUnique({ where: { id: input.matchId }, include: { players: true } });
  if (!match) throw new AppError("Match not found.", 404, "NOT_FOUND");
  if (!match.players.some((p) => p.userId === input.enteredById)) throw new AppError("Only players in this match can enter scores.", 403, "FORBIDDEN");
  if (!SCORING_STATUSES.includes(match.status)) {
    throw new AppError(
      match.status === "OPEN" ? "The match isn't ready yet." : CARD_CLOSED,
      409,
      "CLOSED",
    );
  }
  const playerIds = new Set(match.players.map((p) => p.userId));
  for (const s of input.scores) if (!playerIds.has(s.userId)) throw new AppError("That golfer isn't in this match.", 400);

  await db.$transaction(async (tx) => {
    // Lock the match and check it again, so a score can't land on a card the last confirm is settling.
    await tx.$queryRaw`SELECT 1 FROM "Match" WHERE "id" = ${match.id} FOR UPDATE`;
    const { status } = await tx.match.findUniqueOrThrow({ where: { id: match.id }, select: { status: true } });
    if (!SCORING_STATUSES.includes(status)) throw new AppError(CARD_CLOSED, 409, "CLOSED");
    for (const s of input.scores) {
      await tx.holeScore.upsert({
        where: { matchId_userId_holeNumber: { matchId: match.id, userId: s.userId, holeNumber: input.holeNumber } },
        create: { matchId: match.id, userId: s.userId, holeNumber: input.holeNumber, strokes: s.strokes, enteredById: input.enteredById },
        update: { strokes: s.strokes, enteredById: input.enteredById },
      });
    }
    // A typo fixed on a finished card means everyone looks at it again.
    if (status === "CONFIRMING") await tx.matchPlayer.updateMany({ where: { matchId: match.id }, data: { confirmedAt: null } });
  });
  await onScoresChanged(match.id);
}

/** The match for a route handler, once the signed-in user is known to be one of its players. */
export async function loadPlayerMatch(code: string, userId: string) {
  const match = await loadMatch({ code });
  if (!match) throw new AppError("Match not found.", 404, "NOT_FOUND");
  if (!match.players.some((p) => p.userId === userId)) throw new AppError("Only players in this match can do that.", 403, "FORBIDDEN");
  return match;
}

const MINUTE = 60_000;

/** The golfer's READY/LIVE match with a tee time from 6 h ago to 90 min from now, nearest first. */
export async function activeMatchFor(userId: string, now = new Date()) {
  const matches = await db.match.findMany({
    where: {
      status: { in: ["READY", "LIVE"] },
      players: { some: { userId } },
      teeTime: { startsAt: { gte: new Date(now.getTime() - 6 * 60 * MINUTE), lte: new Date(now.getTime() + 90 * MINUTE) } },
    },
    include: { course: true, teeTime: true },
  });
  matches.sort((a, b) => Math.abs(a.teeTime.startsAt.getTime() - now.getTime()) - Math.abs(b.teeTime.startsAt.getTime() - now.getTime()));
  const m = matches[0];
  if (!m) return null;
  return {
    code: m.code,
    courseName: m.course.name,
    lat: m.course.latitude,
    lng: m.course.longitude,
    geofenceMeters: m.course.geofenceMeters,
    startsAt: m.teeTime.startsAt.toISOString(),
    timeZone: m.course.timezone,
  };
}
