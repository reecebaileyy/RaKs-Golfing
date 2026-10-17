import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { buildPlayView, loadPlayerMatch } from "@/lib/live";
import { callPress } from "@/lib/wagers/round";

const body = z.object({ opponentSide: z.number().int().min(0).max(2), holeNumber: z.number().int().min(1).max(18) });

/** ALOHA PRESS. Eligibility and the extra money hold are decided by callPress. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const input = body.parse(await req.json());
    const match = await loadPlayerMatch((await params).code, user.id);
    await callPress({ matchId: match.id, userId: user.id, opponentSide: input.opponentSide, holeNumber: input.holeNumber });
    return NextResponse.json(buildPlayView(await loadPlayerMatch(match.code, user.id), user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
