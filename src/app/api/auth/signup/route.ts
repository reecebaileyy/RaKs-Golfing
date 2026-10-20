import { NextResponse } from "next/server";
import { z } from "zod";
import { signUp } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

const Body = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters for your password"),
});

export async function POST(req: Request) {
  try {
    const user = await signUp(Body.parse(await req.json()));
    return NextResponse.json({ user: { id: user.id, name: user.name } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
