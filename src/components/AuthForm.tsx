"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signup ? form : { email: form.email, password: form.password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error);
      return;
    }
    // New golfers set up their handicap before anything else.
    router.replace(signup ? `/onboarding?next=${encodeURIComponent(next)}` : next);
    router.refresh();
  }

  const fields = (
    [
      signup && (["name", "Full name", "text", "name"] as const),
      ["email", "Email", "email", "email"] as const,
      ["password", "Password", "password", signup ? "new-password" : "current-password"] as const,
    ].filter(Boolean) as (readonly ["name" | "email" | "password", string, string, string])[]
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map(([key, label, type, autoComplete]) => (
        <label key={key} className="block">
          <span className="mb-1 block text-sm">{label}</span>
          <input
            type={type}
            autoComplete={autoComplete}
            required
            minLength={key === "password" && signup ? 8 : undefined}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
          />
        </label>
      ))}
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
        {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        {signup ? "Already have an account? " : "New to RaKs Golfing? "}
        <Link href={`/${signup ? "signin" : "signup"}?next=${encodeURIComponent(next)}`} className="font-medium text-fairway-600">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
