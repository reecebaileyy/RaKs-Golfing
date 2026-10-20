import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getBalances, listHistory, withdraw } from "@/lib/wagers/ledger";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ balances: await getBalances(user.id), history: await listHistory(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

const Withdraw = z.object({ amountCents: z.number().int().positive("Enter an amount to withdraw."), requestId: z.string().min(8).max(64) });

/** Fake "Withdraw to bank". requestId makes a retried tap a no-op. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const body = Withdraw.parse(await req.json());
    return NextResponse.json({ balances: await withdraw({ userId: user.id, ...body }) });
  } catch (err) {
    return errorResponse(err);
  }
}
