// Who pays whom when a match ends.
//
// - Singles / threesome pairings: loser pays stakeCents to the winner per pairing; tie = nothing.
// - Fourball: each player on the losing side pays stakeCents; each winner receives stakeCents.
// - Press LOST: the press side pays 2 x stake in that pairing (per player for fourball). WON: pairing washed.
// - NINE_POINT: each pair settles (points_i - points_j) x pointValue; then any player's net loss is capped at
//   stakeCents (the loss cap) and the winners' gains are reduced proportionally so the total stays zero.
//   Work in whole cents; push any rounding remainder to the biggest winner so the sum is exactly zero.
// The platform takes no cut. Payouts always sum to zero.
import { formatCents } from "../money";
import { findPairing, pressInPairing } from "./press";
import { computeMatchState, sideLabel } from "./scoring";
import type { MatchScoringInput, MatchState, PairingState, Settlement, Transfer } from "./types";

/** NINE_POINT point values the group can vote on, in cents. */
export const POINT_VALUES = [100, 300, 500] as const;

type PressOutcome = Settlement["pressOutcomes"][number];

/** What one press did on its hole. */
export function pressOutcome(pairing: PairingState, press: { side: number; holeNumber: number }, holeIndex: number): PressOutcome {
  const holeWinner = pairing.holeWinners[holeIndex];
  if (holeWinner === undefined) throw new Error(`Hole ${press.holeNumber} has no result for this pairing`);
  // Stroke play: a press side that ends up winning or tying the match outright just takes the normal result.
  if (pairing.kind === "STROKE" && (pairing.winnerSide === press.side || pairing.winnerSide === null)) return "MOOT";
  if (holeWinner === null) return "TIED";
  return holeWinner === press.side ? "WON" : "LOST";
}

function sidePlayers(input: MatchScoringInput, side: number): string[] {
  return input.players.filter((p) => p.side === side).map((p) => p.id);
}

/** Every loser pays each amount to the winner in the same position, so a 2v2 is two head-to-head transfers. */
function sideTransfers(input: MatchScoringInput, from: number, to: number, cents: number): Transfer[] {
  const payers = sidePlayers(input, from);
  const payees = sidePlayers(input, to);
  if (payers.length !== payees.length) throw new Error("Sides must have the same number of players");
  return payers.map((p, i) => ({ from: p, to: payees[i], cents }));
}

function transferLine(t: Transfer): string {
  return `${t.from} pays ${t.to} ${formatCents(t.cents)}`;
}

function settlePairings(input: MatchScoringInput, state: MatchState): Settlement {
  const stake = input.stakeCents;
  const pressOutcomes: PressOutcome[] = input.presses.map(() => "TIED");
  const transfers: Transfer[] = [];
  const lines: string[] = [];

  for (const pairing of state.pairings) {
    const [a, b] = pairing.sides;
    const label = `${sideLabel(a)} vs ${sideLabel(b)}`;
    // Who pays whom, and how many stakes: starts at the base result.
    let result: { loser: number; winner: number; multiple: number } | null =
      pairing.winnerSide == null
        ? null
        : { winner: pairing.winnerSide, loser: pairing.winnerSide === a ? b : a, multiple: 1 };
    let note = pairing.winnerSide == null ? `${label}: ${pairing.summary}, no money changes hands` : `${label}: ${pairing.summary}`;

    // Presses apply in the order they were called; each acts on the result so far.
    for (const [k, press] of input.presses.entries()) {
      if (!pressInPairing(press, a, b)) continue;
      const holeIndex = input.holes.findIndex((h) => h.number === press.holeNumber);
      if (holeIndex === -1) throw new Error(`Press on unknown hole ${press.holeNumber}`);
      const outcome = pressOutcome(pairing, press, holeIndex);
      pressOutcomes[k] = outcome;
      const who = sideLabel(press.side);
      if (outcome === "WON") {
        result = null;
        note = `${label}: ${who} won the press on ${press.holeNumber}, all bets washed`;
      } else if (outcome === "LOST") {
        result = { loser: press.side, winner: press.side === a ? b : a, multiple: 2 };
        note = `${label}: ${who} lost the press on ${press.holeNumber} and pays double`;
      } else if (outcome === "TIED") {
        note = `${note} (press on ${press.holeNumber} halved, result stands)`;
      } else {
        note = `${note} (press on ${press.holeNumber} moot, result stands)`;
      }
    }

    lines.push(note);
    if (result) {
      for (const t of sideTransfers(input, result.loser, result.winner, stake * result.multiple)) {
        transfers.push(t);
        lines.push(transferLine(t));
      }
    }
  }

  const payouts: Record<string, number> = {};
  for (const p of input.players) payouts[p.id] = 0;
  for (const t of transfers) {
    payouts[t.from] -= t.cents;
    payouts[t.to] += t.cents;
  }
  return { payouts, pressOutcomes, lines, transfers };
}

/**
 * Turns signed nets that sum to zero into who-pays-whom: the biggest loser pays the biggest winner first.
 * Used where money is pooled (the nine point game) rather than settled pair by pair.
 */
export function netTransfers(payouts: Record<string, number>): Transfer[] {
  const losers = Object.entries(payouts).filter(([, c]) => c < 0).map(([id, c]) => ({ id, left: -c }));
  const winners = Object.entries(payouts).filter(([, c]) => c > 0).map(([id, c]) => ({ id, left: c }));
  losers.sort((x, y) => y.left - x.left);
  winners.sort((x, y) => y.left - x.left);
  const transfers: Transfer[] = [];
  let w = 0;
  for (const loser of losers) {
    while (loser.left > 0 && w < winners.length) {
      const cents = Math.min(loser.left, winners[w].left);
      transfers.push({ from: loser.id, to: winners[w].id, cents });
      loser.left -= cents;
      winners[w].left -= cents;
      if (winners[w].left === 0) w++;
    }
  }
  return transfers;
}

/**
 * Nine point money from point totals: pairwise (points_i - points_j) x value, then each net loss capped at
 * capCents with the winners cut back proportionally (floored), the leftover cent or so going to the biggest winner.
 * Returns signed cents per player summing to exactly zero, plus whether the cap kicked in.
 */
export function ninePointPayouts(
  totals: Record<string, number>,
  pointValueCents: number,
  capCents: number,
): { payouts: Record<string, number>; capped: boolean } {
  const ids = Object.keys(totals);
  // Pairwise: each player collects (own points - other's points) x value from each of the others.
  const raw: Record<string, number> = {};
  for (const i of ids) raw[i] = ids.reduce((sum, j) => sum + (totals[i] - totals[j]) * pointValueCents, 0);

  // Loss cap: nobody loses more than the cap. Winners give back what the capped losers couldn't pay.
  const payouts: Record<string, number> = {};
  let paidIn = 0;
  let owedOut = 0;
  for (const id of ids) {
    payouts[id] = raw[id] < 0 ? Math.max(raw[id], -capCents) : 0;
    paidIn -= payouts[id];
    if (raw[id] > 0) owedOut += raw[id];
  }
  const winners = ids.filter((id) => raw[id] > 0).sort((x, y) => raw[y] - raw[x]);
  let handedOut = 0;
  for (const id of winners) {
    payouts[id] = paidIn === owedOut ? raw[id] : Math.floor((raw[id] * paidIn) / owedOut);
    handedOut += payouts[id];
  }
  if (winners.length > 0) payouts[winners[0]] += paidIn - handedOut;
  return { payouts, capped: paidIn < owedOut };
}

function settleNinePoint(input: MatchScoringInput, state: MatchState): Settlement {
  const pointValue = input.pointValueCents;
  if (pointValue == null) throw new Error("The nine point game needs a point value");
  const totals = state.ninePoint!.totals;
  const { payouts, capped } = ninePointPayouts(totals, pointValue, input.stakeCents);

  const ids = input.players.map((p) => p.id);
  const lines = [`Points: ${ids.map((id) => `${id} ${totals[id]}`).join(", ")} at ${formatCents(pointValue)} a point`];
  if (capped) lines.push(`Losses capped at ${formatCents(input.stakeCents)}, winnings reduced to match`);
  const transfers = netTransfers(payouts);
  if (transfers.length === 0) lines.push("All square, no money changes hands");
  for (const t of transfers) lines.push(transferLine(t));
  return { payouts, pressOutcomes: [], lines, transfers };
}

/** Final money for a finished match. Throws if any hole is still missing a score. */
export function settleMatch(input: MatchScoringInput): Settlement {
  const state = computeMatchState(input);
  if (!state.finished) throw new Error("The match isn't finished yet");
  if (!Number.isInteger(input.stakeCents) || input.stakeCents < 0) throw new Error("Stake must be whole cents");
  if (input.format === "NINE_POINT" && input.presses.length > 0) throw new Error("There are no presses in the nine point game");
  for (const press of input.presses) {
    if (input.format !== "NINE_POINT" && !findPairing(state, press.side, press.opponentSide)) {
      throw new Error("Press is not part of a match in this format");
    }
  }
  return input.format === "NINE_POINT" ? settleNinePoint(input, state) : settlePairings(input, state);
}

/** Most a player can lose in this match before any press: what must be held from them at booking. */
export function maxLossCents(format: MatchScoringInput["format"], stakeCents: number): number {
  if (format === "THREESOME_STROKE" || format === "THREESOME_MATCH") return 2 * stakeCents;
  return stakeCents;
}

/** Extra a player on the pressing side must have held when calling a press. */
export function pressHoldCents(stakeCents: number): number {
  return stakeCents;
}

/** NINE_POINT group vote on the point value (100, 300 or 500 cents): majority wins; three different votes -> the lowest. null until everyone has voted. */
export function resolvePointVote(votes: (number | null | undefined)[]): number | null {
  if (votes.length === 0 || votes.some((v) => v == null)) return null;
  const cast = votes as number[];
  for (const v of cast) {
    if (!(POINT_VALUES as readonly number[]).includes(v)) throw new Error(`Invalid point value ${v}`);
  }
  for (const v of POINT_VALUES) {
    if (cast.filter((c) => c === v).length * 2 > cast.length) return v;
  }
  return Math.min(...cast);
}
