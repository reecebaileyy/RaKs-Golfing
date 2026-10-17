import { NextResponse } from "next/server";
import { cancelReservation } from "@/lib/booking";
import { errorResponse } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const reservation = await cancelReservation((await params).code);
    return NextResponse.json({ reservation });
  } catch (err) {
    return errorResponse(err);
  }
}
