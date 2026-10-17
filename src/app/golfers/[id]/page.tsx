import { notFound } from "next/navigation";
import { ProfileView } from "@/components/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profileData";

export const dynamic = "force-dynamic";

// Public: anyone can look at a golfer's record, signed in or not.
export default async function GolferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, me] = await Promise.all([loadProfile(id), getCurrentUser()]);
  if (!profile) notFound();
  return <ProfileView profile={profile} own={me?.id === id} />;
}
