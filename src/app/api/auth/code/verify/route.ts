import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { parseContact } from "@/lib/contact";
import { db } from "@/lib/db";
import { verifyLoginCode } from "@/lib/loginCodes";

const Body = z.object({ contact: z.string().max(254), code: z.string().max(12) });

/** Emails listed in ADMIN_EMAILS become admins once they prove they own the address. */
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const contact = parseContact(body.contact);
    if (!contact || !(await verifyLoginCode(contact.value, body.code))) {
      throw new AppError("That code didn't work. Check it, or ask for a new one.", 400, "BAD_CODE");
    }
    const where = contact.kind === "email" ? { email: contact.value } : { phone: contact.value };
    const user = await db.user.findUnique({ where });
    if (!user) throw new AppError("We couldn't find that account.", 404, "NO_ACCOUNT");
    const now = new Date();
    await db.user.update({
      where: { id: user.id },
      data: {
        ...(contact.kind === "email" ? { emailVerifiedAt: user.emailVerifiedAt ?? now } : { phoneVerifiedAt: user.phoneVerifiedAt ?? now }),
        ...(contact.kind === "email" && adminEmails().includes(contact.value) ? { isAdmin: true } : {}),
      },
    });
    await startSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
