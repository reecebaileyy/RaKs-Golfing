import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api";
import { maskContact, parseContact } from "@/lib/contact";
import { db } from "@/lib/db";
import { issueLoginCode } from "@/lib/loginCodes";
import { echoCodes, sendLoginCode } from "@/lib/messaging";
import { allow, clientIp } from "@/lib/rateLimit";

const Body = z.object({ contact: z.string().max(254) });

/** Sends a one-time sign-in code to the email or phone on an account. */
export async function POST(req: Request) {
  try {
    const contact = parseContact(Body.parse(await req.json()).contact);
    if (!contact) throw new AppError("Enter your email, or a phone number with its area code.");
    if (!allow(`code:${clientIp(req)}`, 10, 10 * 60_000)) throw new AppError("Too many tries. Wait a few minutes.", 429, "RATE_LIMITED");
    const user = await db.user.findUnique({ where: contact.kind === "email" ? { email: contact.value } : { phone: contact.value } });
    if (!user) {
      throw new AppError(`We couldn't find that ${contact.kind === "email" ? "email" : "number"}. Join the waitlist first.`, 404, "NO_ACCOUNT");
    }
    const code = await issueLoginCode(contact.value);
    try {
      await sendLoginCode({ kind: contact.kind, to: contact.value, code });
    } catch (err) {
      console.error("[login code] send failed", err);
      throw new AppError("We couldn't send the code. Try again in a minute.", 502, "SEND_FAILED");
    }
    return NextResponse.json({ ok: true, sentTo: maskContact(contact.kind, contact.value), ...(echoCodes() ? { devCode: code } : {}) });
  } catch (err) {
    return errorResponse(err);
  }
}
