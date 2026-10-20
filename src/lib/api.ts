import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "./booking";

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
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request", code: "INVALID" }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong.", code: "SERVER" }, { status: 500 });
}
