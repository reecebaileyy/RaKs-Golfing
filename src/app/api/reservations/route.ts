import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkout, listReservations } from "@/lib/booking";
import { errorResponse } from "@/lib/api";

const Body = z.object({
  holdId: z.string().min(1),
  golfer: z.object({
    name: z.string().trim().min(2, "Enter your name"),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().max(30).optional(),
  }),
  withProtection: z.boolean().default(false),
  acceptedPolicies: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const reservation = await checkout(Body.parse(await req.json()));
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const email = z.string().email().parse(req.nextUrl.searchParams.get("email"));
    return NextResponse.json({ reservations: await listReservations(email) });
  } catch (err) {
    return errorResponse(err);
  }
}
