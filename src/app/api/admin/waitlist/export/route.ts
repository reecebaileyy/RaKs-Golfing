import { AppError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { waitlistCsv } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

// Every sign-up as a CSV download. Admins only: it holds names, emails and phone numbers.
export async function GET() {
  try {
    const admin = await requireApiUser();
    if (!admin.isAdmin) throw new AppError("Admins only.", 403, "FORBIDDEN");
    const csv = await waitlistCsv();
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="raks-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
