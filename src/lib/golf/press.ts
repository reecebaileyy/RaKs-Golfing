// ALOHA PRESS rules. TO BE IMPLEMENTED by the golf-core worker; signatures are the contract.
//
// Called only by the side that is down, once per pairing:
// - Match play: on any remaining hole once the match is closed out; if it's still alive going to 18,
//   the side that's down can press 18. All square going to 18: no press.
// - Stroke play: on the last hole only, and only if behind through 17.
// - NINE_POINT: no press.
// Outcome on the pressed hole (net or gross per the match):
// - press side wins the hole: all bets in that pairing washed (nobody pays).
// - tie: the match stands as if no press.
// - press side loses the hole: they pay double.
// - MOOT: in stroke play, if after the hole the press side wins or ties the match outright, the normal result applies.
import type { MatchScoringInput, MatchState, PressEligibility } from "./types";

export function pressEligibility(
  input: MatchScoringInput,
  state: MatchState,
  side: number,
  opponentSide: number,
): PressEligibility {
  void input; void state; void side; void opponentSide;
  throw new Error("not implemented");
}
