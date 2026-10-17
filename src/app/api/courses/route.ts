import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { loadCourseOptions } from "@/lib/profileData";

// Read-only: every course with its tee sets and hole pars, for score card entry.
export async function GET() {
  try {
    return NextResponse.json({ courses: await loadCourseOptions() });
  } catch (err) {
    return errorResponse(err);
  }
}
