import { NextResponse } from "next/server";
import { releaseHold } from "@/lib/booking";
import { errorResponse } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await releaseHold((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
