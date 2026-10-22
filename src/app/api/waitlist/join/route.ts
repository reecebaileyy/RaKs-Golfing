import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api";
import { getCurrentUser, startSession } from "@/lib/auth";
import { clearPendingSocial, readPendingSocial } from "@/lib/oauth/flow";
import { allow, clientIp } from "@/lib/rateLimit";
import { isWaitlistMode, waitlistHome } from "@/lib/siteMode";
import { joinWaitlist, waitlistSpot } from "@/lib/waitlist";
import { JOIN_METHODS, ROUNDS_PER_MONTH } from "@/lib/waitlistMath";

const Body = z.object({
  method: z.enum(JOIN_METHODS),
  name: z.string().max(80).default(""),
  email: z.string().max(254).nullish(),
  phone: z.string().max(32).nullish(),
  zip: z.string().max(10).nullish(),
  roundsPerMonth: z.enum(ROUNDS_PER_MONTH).nullish(),
  // Hidden field people never see; bots fill it in.
  website: z.string().max(200).nullish(),
});

function readUtm(raw: string | undefined) {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? { source: v.source ?? null, medium: v.medium ?? null, campaign: v.campaign ?? null } : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (body.website) return NextResponse.json({ ok: true, next: waitlistHome() });
    if (!allow(`join:${clientIp(req)}`, 30, 3_600_000)) throw new AppError("Too many sign-ups from here. Try again later.", 429, "RATE_LIMITED");

    const jar = await cookies();
    const me = await getCurrentUser();
    const pending = body.method === "email" || body.method === "phone" ? null : await readPendingSocial();
    const { userId, created } = await joinWaitlist(
      {
        ...body,
        referralCode: jar.get("raks_ref")?.value ?? null,
        utm: readUtm(jar.get("raks_utm")?.value),
        social: pending ? { provider: pending.provider, profile: pending.profile } : null,
      },
      me?.id,
    );
    if (created) await startSession(userId);
    if (pending) await clearPendingSocial();
    jar.delete("raks_ref");

    // A social sign-in that started outside the waitlist (app mode) carries on to handicap set-up.
    const next = pending && pending.intent !== "waitlist" && !isWaitlistMode() ? `/onboarding?next=${encodeURIComponent(pending.next)}` : waitlistHome();
    return NextResponse.json({ ok: true, next, spot: await waitlistSpot(userId) }, { status: created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
