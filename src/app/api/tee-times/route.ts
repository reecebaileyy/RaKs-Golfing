import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { searchTeeTimes } from "@/lib/booking";
import { errorResponse } from "@/lib/api";

const Query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  players: z.coerce.number().int().min(1).max(4).optional(),
  holes: z.coerce.number().pipe(z.union([z.literal(9), z.literal(18)])).optional(),
  hotDeals: z.enum(["1", "true"]).optional(),
  time: z.enum(["morning", "midday", "twilight"]).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  q: z.string().max(80).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const p = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const results = await searchTeeTimes({
      date: p.date,
      players: p.players,
      holes: p.holes,
      hotDealsOnly: !!p.hotDeals,
      timeOfDay: p.time,
      maxPriceCents: p.maxPrice ? p.maxPrice * 100 : undefined,
      q: p.q,
    });
    return NextResponse.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
