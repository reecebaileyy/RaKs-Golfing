import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { recomputeHandicap } from "@/lib/profile";

const Body = z.object({ userId: z.string().min(1), action: z.enum(["verify", "reject"]) });

// Manual GHIN check until USGA GHIN access is licensed.
export async function POST(req: Request) {
  try {
    const admin = await requireApiUser();
    if (!admin.isAdmin) throw new AppError("Admins only.", 403, "FORBIDDEN");
    const { userId, action } = Body.parse(await req.json());
    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) throw new AppError("Golfer not found.", 404, "NOT_FOUND");
    if (action === "verify") {
      if (!target.ghinNumber || target.ghinIndex === null) throw new AppError("This golfer has no GHIN number on file.");
      await db.user.update({ where: { id: userId }, data: { ghinVerifiedAt: new Date() } });
    } else {
      // Rejected: the number and index are cleared so they can't be played off.
      await db.user.update({ where: { id: userId }, data: { ghinVerifiedAt: null, ghinNumber: null, ghinIndex: null } });
    }
    await recomputeHandicap(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
