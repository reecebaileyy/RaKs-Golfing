import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { recomputeHandicap } from "@/lib/profile";

// Golfers can remove cards they typed in; cards made from matches stay.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const card = await db.scoreCard.findUnique({ where: { id } });
    if (!card || card.userId !== user.id) throw new AppError("Score card not found.", 404, "NOT_FOUND");
    if (card.source !== "MANUAL") throw new AppError("Cards from matches can't be deleted.", 403);
    await db.scoreCard.delete({ where: { id } });
    await recomputeHandicap(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
