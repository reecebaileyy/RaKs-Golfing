"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** For accounts made with a phone number or a social login: adds the email bookings need. */
export function AddEmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
        />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-fairway-700 px-5 py-3 font-semibold text-white disabled:opacity-60">
        {busy ? "One moment…" : "Save email"}
      </button>
    </form>
  );
}
