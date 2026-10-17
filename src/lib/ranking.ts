// Rankings and leaderboard. Owned by the rankings worker; signatures are the contract.

export interface RankingParts {
  winLoss: number; // 0-100
  opponentStrength: number; // 0-100
  scoring: number; // 0-100
  profit: number; // 0-100
}

export interface UserRanking {
  userId: string;
  rank: number | null; // null until the golfer has enough matches
  score: number | null; // 0-100
  parts: RankingParts | null;
  wins: number;
  losses: number;
  ties: number;
  scoringAverage: number | null;
  earningsCents: number;
}

export async function getUserRanking(userId: string): Promise<UserRanking> {
  return { userId, rank: null, score: null, parts: null, wins: 0, losses: 0, ties: 0, scoringAverage: null, earningsCents: 0 };
}
