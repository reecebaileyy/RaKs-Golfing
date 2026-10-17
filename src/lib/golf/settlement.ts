// Who pays whom when a match ends. TO BE IMPLEMENTED by the golf-core worker; signatures are the contract.
//
// - Singles / threesome pairings: loser pays stakeCents to the winner per pairing; tie = nothing.
// - Fourball: each player on the losing side pays stakeCents; each winner receives stakeCents.
// - Press LOST: the press side pays 2 x stake in that pairing (per player for fourball). WON: pairing washed.
// - NINE_POINT: each pair settles (points_i - points_j) x pointValue; then any player's net loss is capped at
//   stakeCents (the loss cap) and the winners' gains are reduced proportionally so the total stays zero.
//   Work in whole cents; push any rounding remainder to the biggest winner so the sum is exactly zero.
// The platform takes no cut. Payouts always sum to zero.
import type { MatchScoringInput, Settlement } from "./types";

export function settleMatch(input: MatchScoringInput): Settlement {
  void input;
  throw new Error("not implemented");
}

/** Most a player can lose in this match before any press: what must be held from them at booking. */
export function maxLossCents(format: MatchScoringInput["format"], stakeCents: number): number {
  void format; void stakeCents;
  throw new Error("not implemented");
}

/** Extra a player on the pressing side must have held when calling a press. */
export function pressHoldCents(stakeCents: number): number {
  void stakeCents;
  throw new Error("not implemented");
}

/** NINE_POINT group vote on the point value (100, 300 or 500 cents): majority wins; three different votes -> the lowest. null until everyone has voted. */
export function resolvePointVote(votes: (number | null | undefined)[]): number | null {
  void votes;
  throw new Error("not implemented");
}
