import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { ProfileView } from "@/components/ProfileView";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth";
import { canPlayMatches } from "@/lib/profile";
import { loadCourseOptions, loadProfile } from "@/lib/profileData";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await requireUser("/profile");
  const [profile, courses, can] = await Promise.all([loadProfile(me.id), loadCourseOptions(), canPlayMatches(me.id)]);
  if (!profile) notFound();
  const { user } = profile;

  return (
    <div className="space-y-5">
      {!can.ok && (
        <div className="card border-flame p-4 text-sm">
          <p className="font-semibold">{can.reason}</p>
          <Link href="/onboarding?next=/profile" className="mt-1 inline-block font-medium text-fairway-600">Set up now</Link>
        </div>
      )}
      <ProfileView profile={profile} own />
      {user.ghinNumber && !user.ghinVerifiedAt && (
        <p className="card p-4 text-sm text-muted">
          Your GHIN number is on file. The Verified badge appears once we check it and you&apos;ve entered a round.
        </p>
      )}
      {user.ghinVerifiedAt && !user.verified && (
        <p className="card p-4 text-sm text-muted">Your GHIN is checked. Enter a round to earn the Verified badge.</p>
      )}
      <ProfileEditForm
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        initial={{ name: user.name, homeCourseId: user.homeCourseId, state: user.state, ghinNumber: user.ghinNumber, ghinIndex: user.ghinIndex }}
      />
      {user.isAdmin && (
        <div className="space-y-2">
          <Link href="/admin/verify" className="block text-center text-sm font-medium text-fairway-600">GHIN verification queue</Link>
          <Link href="/admin/waitlist" className="block text-center text-sm font-medium text-fairway-600">Waitlist dashboard</Link>
        </div>
      )}
      <div className="text-center">
        <SignOutButton />
      </div>
    </div>
  );
}
