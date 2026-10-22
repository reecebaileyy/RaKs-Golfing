"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert, postJoin } from "./JoinFields";

/** For a signed-in golfer who has an account but isn't on the list yet. */
export function JoinAccountCard({ name, method }: { name: string; method: "email" | "phone" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const result = await postJoin({ method, name });
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.replace(result.next);
    router.refresh();
  }

  return (
    <section
      id="join"
      tabIndex={-1}
      className="card scroll-mt-6 text-[var(--foreground)] space-y-4 p-5 shadow-2xl shadow-black/30 outline-none sm:p-6"
    >
      <div>
        <h2 className="text-xl font-bold">Hi {name.split(/\s+/)[0]}, save your spot</h2>
        <p className="text-sm text-muted">You&apos;re signed in. Add this account to the waitlist in one tap.</p>
      </div>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white transition-colors hover:bg-fairway-600 disabled:opacity-60"
      >
        {busy ? "One moment…" : "Join with this account"}
      </button>
    </section>
  );
}
