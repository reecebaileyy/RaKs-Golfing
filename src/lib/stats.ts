// Pure helpers behind the profile stats. No database access, so they are unit tested directly.

export interface CardLike {
  courseId: string;
  courseName: string;
  grossScore: number;
  differential: number;
  playedAt: Date;
}

export interface ScoringStats {
  rounds: number;
  scoringAverage: number | null;
  bestRound: number | null;
  averageDifferential: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoringStats(cards: CardLike[]): ScoringStats {
  if (cards.length === 0) return { rounds: 0, scoringAverage: null, bestRound: null, averageDifferential: null };
  const gross = cards.map((c) => c.grossScore);
  const diffs = cards.map((c) => c.differential);
  return {
    rounds: cards.length,
    scoringAverage: round1(gross.reduce((a, b) => a + b, 0) / gross.length),
    bestRound: Math.min(...gross),
    averageDifferential: round1(diffs.reduce((a, b) => a + b, 0) / diffs.length),
  };
}

/** Courses a golfer has played with how many rounds on each, most played first. */
export function coursesPlayed(cards: CardLike[]): { courseId: string; name: string; rounds: number }[] {
  const byCourse = new Map<string, { courseId: string; name: string; rounds: number }>();
  for (const c of cards) {
    const entry = byCourse.get(c.courseId) ?? { courseId: c.courseId, name: c.courseName, rounds: 0 };
    entry.rounds += 1;
    byCourse.set(c.courseId, entry);
  }
  return [...byCourse.values()].sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name));
}

/** W-L-T from signed match results. Matches with no result yet (null) are left out. */
export function matchRecord(results: (number | null)[]): { wins: number; losses: number; ties: number } {
  const record = { wins: 0, losses: 0, ties: 0 };
  for (const r of results) {
    if (r === null) continue;
    if (r > 0) record.wins += 1;
    else if (r < 0) record.losses += 1;
    else record.ties += 1;
  }
  return record;
}

/** SVG polyline points for a small trend chart. Higher values plot higher. */
export function sparklinePoints(values: number[], width: number, height: number, pad = 4): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + step * i : width / 2;
      const y = max === min ? height / 2 : pad + (height - pad * 2) * (1 - (v - min) / span);
      return `${round1(x)},${round1(y)}`;
    })
    .join(" ");
}

/** Why a set of hole scores can't be saved, or null when it is fine. */
export function holeStrokesError(strokes: unknown): string | null {
  if (!Array.isArray(strokes) || strokes.length !== 18) return "Enter a score for all 18 holes.";
  for (const s of strokes) {
    if (!Number.isInteger(s) || s < 1 || s > 20) return "Each hole needs a score between 1 and 20.";
  }
  return null;
}

/** "+$12.00" / "-$5.00" / "Even" for a signed result in cents. */
export function resultText(cents: number | null, format: (c: number) => string): string {
  if (cents === null) return "No result";
  if (cents === 0) return "Even";
  return `${cents > 0 ? "+" : "-"}${format(Math.abs(cents))}`;
}

export function toPar(score: number, par: number): string {
  const d = score - par;
  return d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`;
}
