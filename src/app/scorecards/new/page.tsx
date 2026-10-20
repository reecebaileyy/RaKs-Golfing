import { NewScoreCard } from "@/components/ScoreCardNew";
import { requireUser } from "@/lib/auth";
import { loadCourseOptions } from "@/lib/profileData";

export const dynamic = "force-dynamic";

export default async function NewScoreCardPage() {
  const user = await requireUser("/scorecards/new");
  const courses = await loadCourseOptions();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Add a round</h1>
      <p className="text-sm text-muted">Enter your score on each hole. We work out your adjusted score and differential.</p>
      <NewScoreCard courses={courses} defaultCourseId={user.homeCourseId} />
    </div>
  );
}
