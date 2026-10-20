// Loads everything a profile page shows: the golfer, their stats, ranking and competition history.
import { db } from "./db";
import { getUserRanking } from "./ranking";
import { conditionsFor, type Conditions } from "./weather";
import { coursesPlayed, matchRecord, scoringStats, type CardLike } from "./stats";

export async function loadCourseOptions() {
  return db.course.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      timezone: true,
      teeSets: { orderBy: { slope: "desc" }, select: { id: true, name: true, courseRating: true, slope: true, par: true } },
      holes: { orderBy: { number: "asc" }, select: { number: true, par: true } },
    },
  });
}

export type CourseOption = Awaited<ReturnType<typeof loadCourseOptions>>[number];

export interface HistoryItem {
  matchId: string;
  code: string;
  startsAt: Date;
  timezone: string;
  courseName: string;
  format: string;
  status: "SETTLED" | "VOID";
  resultCents: number | null;
  conditions: Conditions | null;
}

export async function loadProfile(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [cards, players, ranking, homeCourse] = await Promise.all([
    db.scoreCard.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      include: { course: { select: { name: true, timezone: true } }, teeSet: { select: { name: true } } },
    }),
    db.matchPlayer.findMany({
      where: { userId, match: { status: { in: ["SETTLED", "VOID"] } } },
      include: { match: { include: { course: { select: { name: true, timezone: true } }, teeTime: { select: { startsAt: true } } } } },
    }),
    getUserRanking(userId),
    user.homeCourseId ? db.course.findUnique({ where: { id: user.homeCourseId }, select: { name: true } }) : null,
  ]);

  const like: CardLike[] = cards.map((c) => ({
    courseId: c.courseId,
    courseName: c.course.name,
    grossScore: c.grossScore,
    differential: c.differential,
    playedAt: c.playedAt,
  }));
  const settled = players.filter((p) => p.match.status === "SETTLED");
  const record = matchRecord(settled.map((p) => p.resultCents));

  const history: HistoryItem[] = await Promise.all(
    players
      .sort((a, b) => b.match.teeTime.startsAt.getTime() - a.match.teeTime.startsAt.getTime())
      .map(async (p) => ({
        matchId: p.matchId,
        code: p.match.code,
        startsAt: p.match.teeTime.startsAt,
        timezone: p.match.course.timezone,
        courseName: p.match.course.name,
        format: p.match.format,
        status: p.match.status as "SETTLED" | "VOID",
        resultCents: p.resultCents,
        conditions: await conditionsFor({ matchId: p.matchId, reservationId: p.match.reservationId }).catch(() => null),
      })),
  );

  return {
    user,
    homeCourseName: homeCourse?.name ?? null,
    cards,
    stats: scoringStats(like),
    courses: coursesPlayed(like),
    // Oldest first, last 20: the rounds the handicap is built from.
    trend: [...cards].slice(0, 20).reverse().map((c) => c.differential),
    record,
    ranking,
    history,
  };
}

export type LoadedProfile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
