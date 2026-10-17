"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function LeaderboardCourseSelect({ courses }: { courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <select
      aria-label="Course"
      value={params.get("course") ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("course", e.target.value);
        else next.delete("course");
        router.replace(`/leaderboard?${next.toString()}`, { scroll: false });
      }}
      className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
    >
      <option value="">All courses</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
