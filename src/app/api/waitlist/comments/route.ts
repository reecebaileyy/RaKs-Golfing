import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { postComment } from "@/lib/waitlist";

const Body = z.object({ body: z.string().max(2000) });

/** Posts to the golf talk wall. Signed-in golfers only, so every comment has a person behind it. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const comment = await postComment(user.id, Body.parse(await req.json()).body);
    return NextResponse.json({ id: comment.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
