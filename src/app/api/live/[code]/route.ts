import { NextResponse } from "next/server";
import { getLiveView } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Public live scorecard data. No account needed. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const view = await getLiveView((await params).code);
  if (!view) return NextResponse.json({ error: "Match not found.", code: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(view);
}
