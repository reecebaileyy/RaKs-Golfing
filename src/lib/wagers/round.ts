// Money moments during and after a round. Owned by the wagers worker; signatures are the contract
// the game screen codes against. Each runs in one transaction and writes balanced ledger entries.

/** ALOHA PRESS: checks eligibility (golf/press.ts), holds the extra money from every player on the pressing side, records the Press. */
export async function callPress(input: { matchId: string; userId: string; opponentSide: number; holeNumber: number }): Promise<void> {
  void input;
  throw new Error("not implemented");
}

/** Called after each score write: moves READY -> LIVE on the first score and LIVE -> CONFIRMING once all 18 holes are in. */
export async function onScoresChanged(matchId: string): Promise<void> {
  void matchId;
}

/** A player confirms the final card. When every player has confirmed, the match settles and money moves. */
export async function confirmCard(input: { matchId: string; userId: string }): Promise<void> {
  void input;
  throw new Error("not implemented");
}

/** A player disputes the card: the match goes to DISPUTED and money stays held for review. */
export async function disputeCard(input: { matchId: string; userId: string; reason: string }): Promise<void> {
  void input;
  throw new Error("not implemented");
}
