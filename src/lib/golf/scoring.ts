// Live match state from hole scores. TO BE IMPLEMENTED by the golf-core worker; signatures are the contract.
import type { MatchScoringInput, MatchState } from "./types";

/**
 * Computes everything the game screen and live scorecard show.
 * - Singles: one pairing [0,1]. Fourball: one pairing [0,1] on the best net ball of each side.
 * - Threesome formats: pairings [0,1], [0,2], [1,2].
 * - NINE_POINT: no pairings; 5-3-1 points per hole (ties: 4-4-1, 5-2-2, 3-3-3).
 * A hole counts only once every player in the pairing (or group) has a score on it.
 */
export function computeMatchState(input: MatchScoringInput): MatchState {
  void input;
  throw new Error("not implemented");
}
