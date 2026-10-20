import { AuthForm } from "@/components/AuthForm";

type Params = Promise<{ next?: string }>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const { next } = await searchParams;
  // Only same-site paths, so the link can't bounce people elsewhere.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <AuthForm mode="signin" next={safeNext} />
    </div>
  );
}
