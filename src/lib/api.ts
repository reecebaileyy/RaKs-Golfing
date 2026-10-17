import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "./booking";
import { AuthError } from "./auth";

/** Thrown by feature code for a request the user can fix; maps to the given HTTP status. */
export class AppError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID") {
    super(message);
  }
}

const STATUS: Record<BookingError["code"], number> = {
  NOT_FOUND: 404,
  UNAVAILABLE: 409,
  EXPIRED: 410,
  INVALID: 400,
  PAYMENT_FAILED: 402,
};

export function errorResponse(err: unknown) {
  if (err instanceof BookingError) {
    return NextResponse.json(
      { error: err.message, code: err.code, alternatives: err.alternatives },
      { status: STATUS[err.code] },
    );
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message, code: "AUTH" }, { status: 401 });
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request", code: "INVALID" }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong.", code: "SERVER" }, { status: 500 });
}
