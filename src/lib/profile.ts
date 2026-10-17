// Golfer profiles and handicaps. Owned by the profiles worker; signatures are the contract.

/** Recomputes handicapIndex / handicapSource / verified for a user from their GHIN status and score cards. */
export async function recomputeHandicap(userId: string): Promise<void> {
  void userId;
}

/** A golfer can book a wagered match once they have a GHIN number or 5 score cards. */
export async function canPlayMatches(userId: string): Promise<{ ok: boolean; reason?: string }> {
  void userId;
  return { ok: true };
}

/** After a match settles: saves each player's round as a MATCH score card and recomputes handicaps. */
export async function addMatchScoreCards(matchId: string): Promise<void> {
  void matchId;
}
