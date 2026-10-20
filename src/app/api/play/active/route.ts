import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activeMatchFor } from "@/lib/live";

export const dynamic = "force-dynamic";

/** The signed-in golfer's round that is about to start or underway, or null. Powers the arrival banner. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ match: user ? await activeMatchFor(user.id) : null });
}
