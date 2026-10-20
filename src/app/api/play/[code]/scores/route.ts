import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { buildPlayView, loadPlayerMatch, recordHoleScores, scoresBody } from "@/lib/live";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const body = scoresBody.parse(await req.json());
    const match = await loadPlayerMatch((await params).code, user.id);
    await recordHoleScores({ matchId: match.id, enteredById: user.id, holeNumber: body.holeNumber, scores: body.scores });
    const fresh = await loadPlayerMatch(match.code, user.id);
    return NextResponse.json(buildPlayView(fresh, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
