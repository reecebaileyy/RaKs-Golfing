import { NextResponse } from "next/server";
import { cancelReservation, getReservation } from "@/lib/booking";
import { AppError, errorResponse } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const r = await getReservation(code);
    // Bookings made from an account (every match booking) can only be cancelled by that account or an admin.
    if (r?.golfer.userId) {
      const user = await getCurrentUser();
      if (!user || (user.id !== r.golfer.userId && !user.isAdmin)) {
        throw new AppError("Sign in as the golfer who booked to cancel.", 403, "FORBIDDEN");
      }
    }
    const reservation = await cancelReservation(code);
    return NextResponse.json({ reservation });
  } catch (err) {
    return errorResponse(err);
  }
}
