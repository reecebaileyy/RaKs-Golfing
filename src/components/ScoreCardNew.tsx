"use client";

import { useRouter } from "next/navigation";
import type { CourseOption } from "@/lib/profileData";
import { ScoreCardForm } from "./ScoreCardForm";

/** Stand-alone score card entry: saves, then goes back to the profile. */
export function NewScoreCard({ courses, defaultCourseId }: { courses: CourseOption[]; defaultCourseId: string | null }) {
  const router = useRouter();
  return (
    <ScoreCardForm
      courses={courses}
      defaultCourseId={defaultCourseId}
      onSaved={() => {
        router.push("/profile");
        router.refresh();
      }}
    />
  );
}
