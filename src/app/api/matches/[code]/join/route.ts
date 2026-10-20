import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { joinMatch } from "@/lib/wagers/matches";
import { JoinBody } from "@/lib/wagers/schema";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireApiUser();
    const body = JoinBody.parse(await req.json());
    const match = await joinMatch({ ...body, code: (await params).code, userId: user.id });
    return NextResponse.json({ match: { code: match.code, status: match.status } });
  } catch (err) {
    return errorResponse(err);
  }
}
