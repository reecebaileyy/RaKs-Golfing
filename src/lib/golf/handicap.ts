// World Handicap System math. TO BE IMPLEMENTED by the golf-core worker; signatures are the contract.
import type { HoleInfo, MatchFormat, ScoringBasis, TeeInfo } from "./types";

/** Score differential = (113 / Slope) x (Adjusted Gross Score - Course Rating - PCC), rounded to 1 decimal (USGA rounding: half away from zero). */
export function scoreDifferential(adjustedGross: number, tee: Pick<TeeInfo, "courseRating" | "slope">, pcc = 0): number {
  void adjustedGross; void tee; void pcc;
  throw new Error("not implemented");
}

/**
 * Net double bogey cap for handicap posting: each hole is capped at par + 2 + strokes received on that hole.
 * Without a course handicap yet (new golfer), each hole is capped at par + 5.
 */
export function adjustedGrossScore(strokes: number[], holes: HoleInfo[], courseHandicap: number | null): number {
  void strokes; void holes; void courseHandicap;
  throw new Error("not implemented");
}

/**
 * Handicap Index from score differentials, most recent first (only the latest 20 are used).
 * WHS table: 3 scores -> lowest 1 minus 2.0; 4 -> lowest 1 minus 1.0; 5 -> lowest 1; 6 -> avg lowest 2 minus 1.0;
 * 7-8 -> avg lowest 2; 9-11 -> lowest 3; 12-14 -> lowest 4; 15-16 -> lowest 5; 17-18 -> lowest 6; 19 -> lowest 7; 20 -> lowest 8.
 * Rounded to 1 decimal, capped at 54.0. Returns null with fewer than 3 differentials.
 */
export function handicapIndex(differentials: number[]): number | null {
  void differentials;
  throw new Error("not implemented");
}

/** Course Handicap = Index x (Slope / 113) + (Course Rating - Par), rounded to the nearest whole number. */
export function courseHandicap(index: number, tee: TeeInfo): number {
  void index; void tee;
  throw new Error("not implemented");
}

/** USGA handicap allowance for the format: singles match 100%, singles stroke 95%, four-ball match 90%, four-ball stroke 85%, three-player games 100% match / 95% stroke, nine point 100%. */
export function handicapAllowance(format: MatchFormat): number {
  void format;
  throw new Error("not implemented");
}

/**
 * Strokes each player receives on each hole for a match, "off the low": the lowest playing handicap gets 0,
 * everyone else gets the difference, allocated by stroke index (more than 18 wraps to a second stroke).
 * Playing handicap = round(courseHandicap x allowance). GROSS -> all zeros.
 * Returns per player: { courseHandicap, playingHandicap, strokes: number[18] }.
 */
export function matchStrokes(
  format: MatchFormat,
  scoring: ScoringBasis,
  players: { id: string; handicapIndex: number }[],
  tee: TeeInfo,
  holes: HoleInfo[],
): Record<string, { courseHandicap: number; playingHandicap: number; strokes: number[] }> {
  void format; void scoring; void players; void tee; void holes;
  throw new Error("not implemented");
}
