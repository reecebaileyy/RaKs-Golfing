import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { setCommentHidden } from "@/lib/waitlist";

const Body = z.object({ hidden: z.boolean() });

// Hide or show one "Golf talk" comment on the public wall.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireApiUser();
    if (!admin.isAdmin) throw new AppError("Admins only.", 403, "FORBIDDEN");
    const { id } = await params;
    const { hidden } = Body.parse(await req.json());
    await setCommentHidden(id, hidden);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
