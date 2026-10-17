// ALOHA PRESS rules.
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
import type { MatchScoringInput, MatchState, PairingState, PressEligibility, PressInput } from "./types";

/** The pairing between two sides, in either order. */
export function findPairing(state: MatchState, a: number, b: number): PairingState | undefined {
  return state.pairings.find((p) => (p.sides[0] === a && p.sides[1] === b) || (p.sides[0] === b && p.sides[1] === a));
}

/** True when the press was called in the pairing between these two sides. */
export function pressInPairing(press: PressInput, a: number, b: number): boolean {
  return (press.side === a && press.opponentSide === b) || (press.side === b && press.opponentSide === a);
}

/** The pairing margin seen from one side: positive = that side is ahead. */
export function marginFor(pairing: PairingState, side: number): number {
  return pairing.sides[0] === side ? pairing.margin : -pairing.margin;
}

function no(reason: string): PressEligibility {
  return { eligible: false, reason, holes: [] };
}

export function pressEligibility(
  input: MatchScoringInput,
  state: MatchState,
  side: number,
  opponentSide: number,
): PressEligibility {
  if (input.format === "NINE_POINT") return no("There are no presses in the nine point game");
  const pairing = side === opponentSide ? undefined : findPairing(state, side, opponentSide);
  if (!pairing) return no("There's no match between those sides");
  if (input.presses.some((p) => p.side === side && pressInPairing(p, side, opponentSide))) {
    return no("Already pressed");
  }

  const holeCount = input.holes.length;
  const lastHole = input.holes[holeCount - 1].number;
  const open = input.holes.filter((_, i) => pairing.holeWinners[i] === undefined).map((h) => h.number);
  if (open.length === 0) return no("The match is over");
  if (marginFor(pairing, side) >= 0) return no("Only the side that's down can press");

  // Going to the last hole: every hole but the last complete for this pairing.
  const onLastHole = open.length === 1 && open[0] === lastHole;
  if (pairing.kind === "MATCH") {
    if (pairing.closedOut) return { eligible: true, holes: open };
    if (onLastHole) return { eligible: true, holes: [lastHole] };
    return no("You can press once the match is closed out or on the last hole");
  }
  if (onLastHole) return { eligible: true, holes: [lastHole] };
  return no("In stroke play you can only press the last hole");
}
