import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { leaveMatch } from "@/lib/wagers/matches";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    await leaveMatch({ code: (await params).code, userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
