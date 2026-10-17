// Builders for golf test inputs.
import type { HoleInfo, MatchFormat, MatchScoringInput, PressInput, ScoringBasis } from "../types";

// A realistic stroke index layout: odd indexes on the front, even on the back.
export const STROKE_INDEX = [7, 15, 1, 11, 3, 17, 9, 13, 5, 8, 16, 2, 12, 4, 18, 10, 14, 6];
export const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];

export const HOLES: HoleInfo[] = STROKE_INDEX.map((strokeIndex, i) => ({ number: i + 1, par: PARS[i], strokeIndex }));

/** 18 scores: `base` everywhere, with overrides by hole number. */
export function card(base: number, overrides: Record<number, number | null> = {}, upTo = 18): (number | null)[] {
  return HOLES.map((h) => (h.number > upTo ? null : h.number in overrides ? overrides[h.number] : base));
}

export function makeInput(opts: {
  format: MatchFormat;
  scoring?: ScoringBasis;
  players: [string, number][];
  gross: Record<string, (number | null)[]>;
  strokes?: Record<string, number[]>;
  presses?: PressInput[];
  stakeCents?: number;
  pointValueCents?: number | null;
}): MatchScoringInput {
  const strokes: Record<string, number[]> = {};
  for (const [id] of opts.players) strokes[id] = opts.strokes?.[id] ?? Array(18).fill(0);
  return {
    format: opts.format,
    scoring: opts.scoring ?? (opts.strokes ? "NET" : "GROSS"),
    holes: HOLES,
    players: opts.players.map(([id, side]) => ({ id, side })),
    strokes,
    gross: opts.gross,
    presses: opts.presses ?? [],
    stakeCents: opts.stakeCents ?? 2000,
    pointValueCents: opts.pointValueCents,
  };
}

/** Deterministic pseudo random numbers for property-style tests. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
