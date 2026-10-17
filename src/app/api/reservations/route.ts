import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkout, listReservations, listUserReservations } from "@/lib/booking";
import { errorResponse } from "@/lib/api";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { MatchSetupBody } from "@/lib/wagers/schema";

const Body = z.object({
  holdId: z.string().min(1),
  golfer: z.object({
    name: z.string().trim().min(2, "Enter your name"),
    phone: z.string().trim().max(30).optional(),
  }),
  withProtection: z.boolean().default(false),
  acceptedPolicies: z.boolean(),
  match: MatchSetupBody,
});

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const reservation = await checkout({ ...Body.parse(await req.json()), userId: user.id });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Signed in: your bookings. Guest bookings from before accounts are still looked up by email. */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    const user = email ? null : await getCurrentUser();
    if (user) return NextResponse.json({ reservations: await listUserReservations(user.id) });
    return NextResponse.json({ reservations: await listReservations(z.string().email().parse(email)) });
  } catch (err) {
    return errorResponse(err);
  }
}
