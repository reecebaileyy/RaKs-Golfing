import Link from "next/link";

export function WaitlistFooter({ signInHref }: { signInHref: string }) {
  return (
    <footer className="mt-auto border-t border-line py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 text-sm text-muted">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} RaKs Golfing</p>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/terms" className="underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            <Link href={signInHref} className="underline">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="text-xs">Money matches launch only where they&apos;re allowed.</p>
      </div>
    </footer>
  );
}
