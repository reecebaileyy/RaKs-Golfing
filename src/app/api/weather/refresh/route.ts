// Cron hook: saves the observed conditions for tee times that have finished.
// Set CRON_SECRET and call with "Authorization: Bearer <secret>". Without a secret the route is closed.
import { NextResponse } from "next/server";
import { refreshActuals } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed", code: "AUTH" }, { status: 401 });
  }
  const saved = await refreshActuals(new Date());
  return NextResponse.json({ saved });
}
