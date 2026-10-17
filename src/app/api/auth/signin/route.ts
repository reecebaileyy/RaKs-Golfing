import { NextResponse } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

const Body = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

export async function POST(req: Request) {
  try {
    const user = await signIn(Body.parse(await req.json()));
    return NextResponse.json({ user: { id: user.id, name: user.name } });
  } catch (err) {
    return errorResponse(err);
  }
}
