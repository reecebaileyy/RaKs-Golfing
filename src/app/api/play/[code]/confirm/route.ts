import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { buildPlayView, loadPlayerMatch } from "@/lib/live";
import { confirmCard } from "@/lib/wagers/round";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const match = await loadPlayerMatch((await params).code, user.id);
    await confirmCard({ matchId: match.id, userId: user.id });
    return NextResponse.json(buildPlayView(await loadPlayerMatch(match.code, user.id), user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
