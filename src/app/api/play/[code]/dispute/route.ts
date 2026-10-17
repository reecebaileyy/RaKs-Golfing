import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { buildPlayView, loadPlayerMatch } from "@/lib/live";
import { disputeCard } from "@/lib/wagers/round";

const body = z.object({ reason: z.string().trim().min(3, "Tell us what's wrong with the card.").max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const { reason } = body.parse(await req.json());
    const match = await loadPlayerMatch((await params).code, user.id);
    await disputeCard({ matchId: match.id, userId: user.id, reason });
    return NextResponse.json(buildPlayView(await loadPlayerMatch(match.code, user.id), user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
