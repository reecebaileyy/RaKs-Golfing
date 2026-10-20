import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { recomputeHandicap } from "@/lib/profile";

const Body = z.object({
  name: z.string().trim().min(2, "Enter your name").optional(),
  homeCourseId: z.string().nullable().optional(),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use the two-letter state, like CA")
    .nullable()
    .optional(),
  ghinNumber: z
    .string()
    .trim()
    .regex(/^\d{5,10}$/, "Your GHIN number is 5 to 10 digits")
    .nullable()
    .optional(),
  ghinIndex: z.number().min(-10, "Enter your index as shown in your GHIN app").max(54, "The highest index is 54.0").nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireApiUser();
    const body = Body.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.state !== undefined) data.state = body.state ? body.state.toUpperCase() : null;
    if (body.homeCourseId !== undefined) {
      if (body.homeCourseId && !(await db.course.findUnique({ where: { id: body.homeCourseId }, select: { id: true } }))) {
        throw new AppError("That course doesn't exist.", 404, "NOT_FOUND");
      }
      data.homeCourseId = body.homeCourseId || null;
    }
    if (body.ghinNumber !== undefined) {
      data.ghinNumber = body.ghinNumber || null;
      // A different GHIN number has not been checked yet.
      if ((body.ghinNumber || null) !== user.ghinNumber) data.ghinVerifiedAt = null;
      if (!body.ghinNumber) data.ghinIndex = null;
    }
    if (body.ghinIndex !== undefined && body.ghinNumber !== null) data.ghinIndex = body.ghinIndex;
    const nextNumber = "ghinNumber" in data ? data.ghinNumber : user.ghinNumber;
    if (nextNumber && (("ghinIndex" in data ? data.ghinIndex : user.ghinIndex) ?? null) === null) {
      throw new AppError("Enter your current index as shown in your GHIN app.");
    }
    await db.user.update({ where: { id: user.id }, data });
    await recomputeHandicap(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
