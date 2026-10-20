import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadCourseOptions } from "@/lib/profileData";

export const dynamic = "force-dynamic";

type Params = Promise<{ next?: string }>;

export default async function OnboardingPage({ searchParams }: { searchParams: Params }) {
  const { next } = await searchParams;
  // Only same-site paths, so the link can't bounce people elsewhere.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  const user = await requireUser(`/onboarding?next=${encodeURIComponent(safeNext)}`);
  const [courses, existingCards] = await Promise.all([loadCourseOptions(), db.scoreCard.count({ where: { userId: user.id } })]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set up your handicap</h1>
        <p className="mt-1 text-sm text-muted">
          Matches are played off your handicap. Add your GHIN number, or enter your 5 most recent rounds.
        </p>
      </div>
      <ProfileOnboarding courses={courses} next={safeNext} existingCards={Math.min(existingCards, 4)} />
    </div>
  );
}
