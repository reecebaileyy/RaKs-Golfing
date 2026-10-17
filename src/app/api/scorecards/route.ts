import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { adjustedGrossScore, courseHandicap, scoreDifferential } from "@/lib/golf/handicap";
import { recomputeHandicap } from "@/lib/profile";
import { holeStrokesError } from "@/lib/stats";
import { todayIn, zonedTime } from "@/lib/time";

const Body = z.object({
  courseId: z.string().min(1),
  teeSetId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date you played"),
  strokes: z.array(z.number()),
});

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const body = Body.parse(await req.json());
    const bad = holeStrokesError(body.strokes);
    if (bad) throw new AppError(bad);

    const course = await db.course.findUnique({
      where: { id: body.courseId },
      include: { holes: { orderBy: { number: "asc" } }, teeSets: { where: { id: body.teeSetId } } },
    });
    const tee = course?.teeSets[0];
    if (!course || !tee) throw new AppError("Pick a course and tees.", 404, "NOT_FOUND");
    if (body.date > todayIn(course.timezone)) throw new AppError("That date is in the future.");

    // Hole caps use the golfer's current course handicap; new golfers get the flat par + 5 cap.
    const holes = course.holes.map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex }));
    const ch = user.handicapIndex === null ? null : courseHandicap(user.handicapIndex, tee);
    const adjustedGross = adjustedGrossScore(body.strokes, holes, ch);
    const card = await db.scoreCard.create({
      data: {
        userId: user.id,
        courseId: course.id,
        teeSetId: tee.id,
        playedAt: zonedTime(body.date, 12, 0, course.timezone),
        holeStrokes: JSON.stringify(body.strokes),
        grossScore: body.strokes.reduce((a, b) => a + b, 0),
        adjustedGross,
        differential: scoreDifferential(adjustedGross, tee),
        source: "MANUAL",
      },
    });
    await recomputeHandicap(user.id);
    return NextResponse.json({ id: card.id, differential: card.differential }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
