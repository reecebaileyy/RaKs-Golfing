import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { buildPlayView, loadPlayerMatch } from "@/lib/live";

export const dynamic = "force-dynamic";

/** The game screen's view of the match: scores, status, press options and money for the signed-in player. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const match = await loadPlayerMatch((await params).code, user.id);
    return NextResponse.json(buildPlayView(match, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
