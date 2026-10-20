// World Handicap System math (USGA Rules of Handicapping) and the strokes each player gets in a match.
import type { HoleInfo, MatchFormat, ScoringBasis, TeeInfo } from "./types";

/** Rounds half away from zero, the USGA convention. The tiny nudge absorbs float noise like 2.4999999999. */
export function roundHalfAway(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.floor(scaled + 0.5 + 1e-9) / factor;
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

/**
 * Handicap strokes on a hole for a handicap allocated by stroke index: stroke index 1 gets the first stroke,
 * more than one full round of strokes wraps (19 strokes = 2 on SI 1, 1 on every other hole).
 * A plus (negative) handicap gives strokes back starting from the easiest hole (highest stroke index).
 */
export function strokesOnHole(handicap: number, strokeIndex: number, holeCount = 18): number {
  if (handicap >= 0) {
    return Math.floor(handicap / holeCount) + (strokeIndex <= handicap % holeCount ? 1 : 0);
  }
  const back = -handicap;
  const given = Math.floor(back / holeCount) + (strokeIndex > holeCount - (back % holeCount) ? 1 : 0);
  return given === 0 ? 0 : -given;
}

/** Score differential = (113 / Slope) x (Adjusted Gross Score - Course Rating - PCC), rounded to 1 decimal (USGA rounding: half away from zero). */
export function scoreDifferential(adjustedGross: number, tee: Pick<TeeInfo, "courseRating" | "slope">, pcc = 0): number {
  return roundHalfAway((113 / tee.slope) * (adjustedGross - tee.courseRating - pcc), 1);
}

/**
 * Net double bogey cap for handicap posting: each hole is capped at par + 2 + strokes received on that hole.
 * Without a course handicap yet (new golfer), each hole is capped at par + 5.
 */
export function adjustedGrossScore(strokes: number[], holes: HoleInfo[], courseHandicap: number | null): number {
  let total = 0;
  holes.forEach((hole, i) => {
    const score = strokes[i];
    if (score == null) return;
    const cap =
      courseHandicap == null
        ? hole.par + 5
        : hole.par + 2 + strokesOnHole(courseHandicap, hole.strokeIndex, holes.length);
    total += Math.min(score, cap);
  });
  return total;
}

// WHS table: how many of the lowest differentials count, and the adjustment, by number of scores.
const INDEX_TABLE: Record<number, { count: number; adjustment: number }> = {
  3: { count: 1, adjustment: -2 },
  4: { count: 1, adjustment: -1 },
  5: { count: 1, adjustment: 0 },
  6: { count: 2, adjustment: -1 },
  7: { count: 2, adjustment: 0 },
  8: { count: 2, adjustment: 0 },
  9: { count: 3, adjustment: 0 },
  10: { count: 3, adjustment: 0 },
  11: { count: 3, adjustment: 0 },
  12: { count: 4, adjustment: 0 },
  13: { count: 4, adjustment: 0 },
  14: { count: 4, adjustment: 0 },
  15: { count: 5, adjustment: 0 },
  16: { count: 5, adjustment: 0 },
  17: { count: 6, adjustment: 0 },
  18: { count: 6, adjustment: 0 },
  19: { count: 7, adjustment: 0 },
  20: { count: 8, adjustment: 0 },
};

/**
 * Handicap Index from score differentials, most recent first (only the latest 20 are used).
 * WHS table: 3 scores -> lowest 1 minus 2.0; 4 -> lowest 1 minus 1.0; 5 -> lowest 1; 6 -> avg lowest 2 minus 1.0;
 * 7-8 -> avg lowest 2; 9-11 -> lowest 3; 12-14 -> lowest 4; 15-16 -> lowest 5; 17-18 -> lowest 6; 19 -> lowest 7; 20 -> lowest 8.
 * Rounded to 1 decimal, capped at 54.0. Returns null with fewer than 3 differentials.
 */
export function handicapIndex(differentials: number[]): number | null {
  const recent = differentials.slice(0, 20);
  const rule = INDEX_TABLE[recent.length];
  if (!rule) return null;
  const lowest = [...recent].sort((a, b) => a - b).slice(0, rule.count);
  const average = lowest.reduce((sum, d) => sum + d, 0) / rule.count;
  return Math.min(54, roundHalfAway(average + rule.adjustment, 1));
}

/** Course Handicap = Index x (Slope / 113) + (Course Rating - Par), rounded to the nearest whole number. */
export function courseHandicap(index: number, tee: TeeInfo): number {
  return roundHalfAway(index * (tee.slope / 113) + (tee.courseRating - tee.par));
}

/** USGA handicap allowance for the format: singles match 100%, singles stroke 95%, four-ball match 90%, four-ball stroke 85%, three-player games 100% match / 95% stroke, nine point 100%. */
export function handicapAllowance(format: MatchFormat): number {
  switch (format) {
    case "SINGLES_MATCH":
    case "THREESOME_MATCH":
    case "NINE_POINT":
      return 1;
    case "SINGLES_STROKE":
    case "THREESOME_STROKE":
      return 0.95;
    case "FOURBALL_MATCH":
      return 0.9;
    case "FOURBALL_STROKE":
      return 0.85;
  }
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
  const allowance = handicapAllowance(format);
  const handicaps = players.map((p) => {
    const ch = courseHandicap(p.handicapIndex, tee);
    return { id: p.id, courseHandicap: ch, playingHandicap: roundHalfAway(ch * allowance) };
  });
  const low = Math.min(...handicaps.map((h) => h.playingHandicap));
  const result: Record<string, { courseHandicap: number; playingHandicap: number; strokes: number[] }> = {};
  for (const h of handicaps) {
    const given = h.playingHandicap - low;
    result[h.id] = {
      courseHandicap: h.courseHandicap,
      playingHandicap: h.playingHandicap,
      strokes: holes.map((hole) => (scoring === "GROSS" ? 0 : strokesOnHole(given, hole.strokeIndex, holes.length))),
    };
  }
  return result;
}
