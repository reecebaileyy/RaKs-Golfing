// Live match state from hole scores: match play, stroke play, best ball and the nine point game.
import type { MatchFormat, MatchScoringInput, MatchState, PairingState } from "./types";

const SIDE_LABELS = ["Side A", "Side B", "Side C"];

/** "Side A", "Side B", "Side C" for sides 0/1/2. The UI swaps in player names. */
export function sideLabel(side: number): string {
  return SIDE_LABELS[side] ?? `Side ${side + 1}`;
}

/** Head-to-head contests in a format: one for 2-sided formats, every pair for threesomes, none for nine point. */
export function formatPairings(format: MatchFormat): [number, number][] {
  switch (format) {
    case "NINE_POINT":
      return [];
    case "THREESOME_STROKE":
    case "THREESOME_MATCH":
      return [
        [0, 1],
        [0, 2],
        [1, 2],
      ];
    default:
      return [[0, 1]];
  }
}

export function isMatchPlay(format: MatchFormat): boolean {
  return format === "SINGLES_MATCH" || format === "FOURBALL_MATCH" || format === "THREESOME_MATCH";
}

/** Net (or gross) score per player per hole. */
function netScores(input: MatchScoringInput): Record<string, (number | null)[]> {
  const net: Record<string, (number | null)[]> = {};
  for (const p of input.players) {
    const gross = input.gross[p.id] ?? [];
    const strokes = input.strokes[p.id] ?? [];
    net[p.id] = input.holes.map((_, i) => {
      const g = gross[i];
      if (g == null) return null;
      return input.scoring === "GROSS" ? g : g - (strokes[i] ?? 0);
    });
  }
  return net;
}

/**
 * A side's score on each hole: the best (lowest) net of its players, or undefined until every player
 * in the pairing has a score on that hole.
 */
function sideHoleScores(
  input: MatchScoringInput,
  net: Record<string, (number | null)[]>,
  sides: [number, number],
): ([number, number] | undefined)[] {
  const ids = (side: number) => input.players.filter((p) => p.side === side).map((p) => p.id);
  const a = ids(sides[0]);
  const b = ids(sides[1]);
  return input.holes.map((_, i) => {
    const sa = a.map((id) => net[id][i]);
    const sb = b.map((id) => net[id][i]);
    if (sa.length === 0 || sb.length === 0 || [...sa, ...sb].some((s) => s == null)) return undefined;
    return [Math.min(...(sa as number[])), Math.min(...(sb as number[]))];
  });
}

function matchPlayPairing(scores: ([number, number] | undefined)[], sides: [number, number]): PairingState {
  const holeCount = scores.length;
  const holeWinners: (number | null | undefined)[] = scores.map((s) => {
    if (!s) return undefined;
    if (s[0] === s[1]) return null;
    return s[0] < s[1] ? sides[0] : sides[1];
  });
  let completed = 0;
  let margin = 0;
  let closedOut = false;
  let decidedWith = 0; // holes remaining when the match was closed out
  for (const w of holeWinners) {
    if (w === undefined) continue;
    completed++;
    // Once closed out the result is fixed; later holes only fill in holeWinners (presses need them).
    if (closedOut) continue;
    if (w === sides[0]) margin++;
    else if (w === sides[1]) margin--;
    if (Math.abs(margin) > holeCount - completed) {
      closedOut = true;
      decidedWith = holeCount - completed;
    }
  }

  let winnerSide: number | null | undefined;
  let summary: string;
  const leader = margin > 0 ? sides[0] : sides[1];
  if (closedOut) {
    winnerSide = leader;
    summary =
      decidedWith === 0
        ? `${sideLabel(leader)} wins ${Math.abs(margin)} UP`
        : `${sideLabel(leader)} wins ${Math.abs(margin)}&${decidedWith}`;
  } else if (completed === holeCount) {
    winnerSide = null;
    summary = "Halved";
  } else if (completed === 0) {
    summary = "Not started";
  } else if (margin === 0) {
    summary = `All square thru ${completed}`;
  } else {
    summary = `${sideLabel(leader)} ${Math.abs(margin)} UP thru ${completed}`;
  }
  return { sides, kind: "MATCH", holesCompleted: completed, margin, closedOut, winnerSide, summary, holeWinners };
}

function strokePlayPairing(scores: ([number, number] | undefined)[], sides: [number, number]): PairingState {
  const holeCount = scores.length;
  const holeWinners: (number | null | undefined)[] = scores.map((s) => {
    if (!s) return undefined;
    if (s[0] === s[1]) return null;
    return s[0] < s[1] ? sides[0] : sides[1];
  });
  let completed = 0;
  let margin = 0; // sides[1] total minus sides[0] total: positive = sides[0] ahead
  for (const s of scores) {
    if (!s) continue;
    completed++;
    margin += s[1] - s[0];
  }
  const leader = margin > 0 ? sides[0] : sides[1];
  let winnerSide: number | null | undefined;
  let summary: string;
  if (completed === holeCount) {
    winnerSide = margin === 0 ? null : leader;
    summary = margin === 0 ? "Tied" : `${sideLabel(leader)} wins by ${Math.abs(margin)}`;
  } else if (completed === 0) {
    summary = "Not started";
  } else if (margin === 0) {
    summary = `Tied thru ${completed}`;
  } else {
    summary = `${sideLabel(leader)} by ${Math.abs(margin)} thru ${completed}`;
  }
  return { sides, kind: "STROKE", holesCompleted: completed, margin, closedOut: false, winnerSide, summary, holeWinners };
}

/** Nine point game points for one hole from the three nets: 5-3-1; ties 4-4-1, 5-2-2, 3-3-3. */
export function ninePointHole(nets: [number, number, number]): [number, number, number] {
  const order = [0, 1, 2].sort((a, b) => nets[a] - nets[b]);
  const [best, mid, worst] = order.map((i) => nets[i]);
  const points: [number, number, number] = [0, 0, 0];
  let byRank: [number, number, number];
  if (best === worst) byRank = [3, 3, 3];
  else if (best === mid) byRank = [4, 4, 1];
  else if (mid === worst) byRank = [5, 2, 2];
  else byRank = [5, 3, 1];
  order.forEach((player, rank) => (points[player] = byRank[rank]));
  return points;
}

function ninePoint(input: MatchScoringInput, net: Record<string, (number | null)[]>): MatchState["ninePoint"] {
  if (input.players.length !== 3) throw new Error("The nine point game needs exactly three players");
  const ids = input.players.map((p) => p.id);
  const perHole: Record<string, (number | null)[]> = {};
  const totals: Record<string, number> = {};
  for (const id of ids) {
    perHole[id] = [];
    totals[id] = 0;
  }
  input.holes.forEach((_, i) => {
    const nets = ids.map((id) => net[id][i]);
    if (nets.some((n) => n == null)) {
      for (const id of ids) perHole[id].push(null);
      return;
    }
    const points = ninePointHole(nets as [number, number, number]);
    ids.forEach((id, k) => {
      perHole[id].push(points[k]);
      totals[id] += points[k];
    });
  });
  return { perHole, totals };
}

/**
 * Computes everything the game screen and live scorecard show.
 * - Singles: one pairing [0,1]. Fourball: one pairing [0,1] on the best net ball of each side.
 * - Threesome formats: pairings [0,1], [0,2], [1,2].
 * - NINE_POINT: no pairings; 5-3-1 points per hole (ties: 4-4-1, 5-2-2, 3-3-3).
 * A hole counts only once every player in the pairing (or group) has a score on it.
 */
export function computeMatchState(input: MatchScoringInput): MatchState {
  const net = netScores(input);
  const holeCount = input.holes.length;
  const holeDone = input.holes.map((_, i) => input.players.every((p) => net[p.id][i] != null));
  const firstOpen = holeDone.indexOf(false);
  const holesCompleted = firstOpen === -1 ? holeCount : firstOpen;

  const matchPlay = isMatchPlay(input.format);
  const pairings = formatPairings(input.format).map((sides) => {
    const scores = sideHoleScores(input, net, sides);
    return matchPlay ? matchPlayPairing(scores, sides) : strokePlayPairing(scores, sides);
  });

  const state: MatchState = {
    format: input.format,
    holesCompleted,
    finished: firstOpen === -1,
    net,
    pairings,
    currentHole: firstOpen === -1 ? null : input.holes[firstOpen].number,
  };
  if (input.format === "NINE_POINT") state.ninePoint = ninePoint(input, net);
  return state;
}
