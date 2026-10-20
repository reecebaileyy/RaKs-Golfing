import { NextResponse } from "next/server";
import { z } from "zod";
import { createHold } from "@/lib/booking";
import { errorResponse } from "@/lib/api";

const Body = z.object({ rateId: z.string().min(1), players: z.number().int().min(1).max(4) });

export async function POST(req: Request) {
  try {
    const hold = await createHold(Body.parse(await req.json()));
    return NextResponse.json({ hold }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
