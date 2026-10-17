import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { getLeaderboard, LEADERBOARD_PERIODS, LEADERBOARD_SORTS } from "@/lib/ranking";

const Query = z.object({
  sort: z.enum(LEADERBOARD_SORTS).default("ranking"),
  period: z.enum(LEADERBOARD_PERIODS).default("all"),
  course: z.string().max(40).optional(),
});

// Public: anyone can see the leaderboard, signed in or not.
export async function GET(req: NextRequest) {
  try {
    const p = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const rows = await getLeaderboard({ sort: p.sort, period: p.period, courseId: p.course || undefined });
    return NextResponse.json({ sort: p.sort, period: p.period, courseId: p.course || null, rows });
  } catch (err) {
    return errorResponse(err);
  }
}
