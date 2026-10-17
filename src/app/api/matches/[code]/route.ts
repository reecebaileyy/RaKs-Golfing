// Match actions after tee off, for the game screen: press, confirm, dispute, and admin review.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sweepMatches } from "@/lib/wagers/matches";
import { callPress, confirmCard, disputeCard, resolveDispute } from "@/lib/wagers/round";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("press"), opponentSide: z.number().int().min(0).max(2), holeNumber: z.number().int().min(1).max(18) }),
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("dispute"), reason: z.string().trim().min(3, "Say what's wrong with the card.").max(500) }),
  z.object({ action: z.literal("resolve"), resolution: z.enum(["settle", "refund"]) }),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await sweepMatches();
    const match = await db.match.findUnique({
      where: { code: (await params).code.toUpperCase() },
      select: { code: true, status: true, format: true, scoring: true, stakeCents: true, pointValueCents: true },
    });
    if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
    return NextResponse.json({ match });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const body = Body.parse(await req.json());
    const match = await db.match.findUnique({ where: { code: (await params).code.toUpperCase() }, select: { id: true } });
    if (!match) throw new AppError("We couldn't find that match.", 404, "NOT_FOUND");
    const matchId = match.id;

    if (body.action === "press") await callPress({ matchId, userId: user.id, opponentSide: body.opponentSide, holeNumber: body.holeNumber });
    if (body.action === "confirm") await confirmCard({ matchId, userId: user.id });
    if (body.action === "dispute") await disputeCard({ matchId, userId: user.id, reason: body.reason });
    if (body.action === "resolve") {
      if (!user.isAdmin) throw new AppError("Only admins can resolve disputes.", 403, "FORBIDDEN");
      await resolveDispute(matchId, body.resolution);
    }
    const after = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { code: true, status: true } });
    return NextResponse.json({ match: after });
  } catch (err) {
    return errorResponse(err);
  }
}
