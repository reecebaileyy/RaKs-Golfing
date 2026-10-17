// Shared types for the pure golf logic in src/lib/golf. Nothing here touches the database,
// so every rule (handicaps, scoring, presses, settlement) is unit tested in isolation.
// Rules follow the USGA Rules of Golf and Rules of Handicapping (World Handicap System).

export type MatchFormat =
  | "SINGLES_STROKE"
  | "SINGLES_MATCH"
  | "FOURBALL_STROKE"
  | "FOURBALL_MATCH"
  | "NINE_POINT"
  | "THREESOME_STROKE"
  | "THREESOME_MATCH";

export type ScoringBasis = "NET" | "GROSS";

export interface HoleInfo {
  number: number; // 1-18
  par: number;
  strokeIndex: number; // 1 = hardest
}

export interface TeeInfo {
  courseRating: number;
  slope: number;
  par: number;
}

export interface MatchPlayerInput {
  id: string;
  /** 0/1 for singles and fourball teams; 0/1/2 for three-player games. */
  side: number;
}

export interface PressInput {
  side: number;
  /** Two-sided formats: the other side. Three-player formats: the opponent the press is against. */
  opponentSide: number;
  holeNumber: number;
}

/** Everything needed to score and settle a match. Arrays are indexed by hole - 1. */
export interface MatchScoringInput {
  format: MatchFormat;
  scoring: ScoringBasis;
  holes: HoleInfo[]; // 18, in order
  players: MatchPlayerInput[];
  /** Handicap strokes each player receives on each hole (all zeros for GROSS). */
  strokes: Record<string, number[]>;
  /** Gross strokes entered so far; null = not entered yet. */
  gross: Record<string, (number | null)[]>;
  presses: PressInput[];
  /** Per player per pairing. NINE_POINT: each player's loss cap. */
  stakeCents: number;
  /** NINE_POINT only. */
  pointValueCents?: number | null;
}

/** One head-to-head contest inside a match: the whole match for 2-sided formats, each pair for threesomes. */
export interface PairingState {
  sides: [number, number];
  kind: "STROKE" | "MATCH";
  /** Holes where both sides have complete scores, in order. */
  holesCompleted: number;
  /** Match play: holes won by sides[0] minus holes won by sides[1]. Stroke play: strokes sides[1] minus sides[0] (positive = sides[0] ahead). */
  margin: number;
  /** Match play only: one side is up by more holes than remain. */
  closedOut: boolean;
  /** Set once the pairing is decided (closed out, or all 18 complete). null = halved/tied. undefined = still going. */
  winnerSide?: number | null;
  /** Short status for the UI, e.g. "2 UP thru 7", "3&2", "AS", "+3 thru 12", "Tied". Phrased from sides[0]'s view with a side label. */
  summary: string;
  /** Per hole: winning side, null = halved, undefined = not complete. Stroke play: lower score on that hole. */
  holeWinners: (number | null | undefined)[];
}

export interface MatchState {
  format: MatchFormat;
  /** Holes 1..n all complete for every player. */
  holesCompleted: number;
  /** All 18 holes complete for every player. */
  finished: boolean;
  /** Net (or gross) score per player per hole, null = not entered. */
  net: Record<string, (number | null)[]>;
  pairings: PairingState[];
  /** NINE_POINT only: points per player per hole and running totals. */
  ninePoint?: { perHole: Record<string, (number | null)[]>; totals: Record<string, number> };
  /** Next hole nobody has finished, 1-18, or null when finished. */
  currentHole: number | null;
}

export interface PressEligibility {
  eligible: boolean;
  /** Why not, in words a golfer reads. */
  reason?: string;
  /** Holes the press may be called on right now. */
  holes: number[];
}

export interface Settlement {
  /** Signed cents per player. Always sums to zero. Positive = receives. */
  payouts: Record<string, number>;
  /** Outcome of each press, same order as input.presses. */
  pressOutcomes: ("WON" | "TIED" | "LOST" | "MOOT")[];
  /** Human readable lines explaining the money, for the results screen. */
  lines: string[];
}
