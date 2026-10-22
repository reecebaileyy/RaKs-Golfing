"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProviderId } from "@/lib/oauth/providers";
import { ErrorAlert, Honeypot, LegalNote, postJoin, RoundsSelect, TextField } from "./JoinFields";

type Problem = { text: string; link?: { href: string; label: string } };

/** Step 2 of joining with a social login: the email or phone number every account needs. */
export function FinishForm({ provider, defaultName, home }: { provider: ProviderId; defaultName: string; home: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: defaultName, email: "", phone: "", zip: "", rounds: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.email.trim() && !form.phone.trim()) {
      setError({ text: "Add an email or a phone number." });
      return;
    }
    setBusy(true);
    const result = await postJoin({
      method: provider,
      name: form.name,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      zip: form.zip.trim() || undefined,
      roundsPerMonth: form.rounds || undefined,
      website: form.website,
    });
    if (!result.ok) {
      setBusy(false);
      setError({
        text: result.error,
        link:
          result.code === "EXISTS"
            ? { href: `/signin?next=${encodeURIComponent(home)}`, label: "Sign in" }
            : result.code === "SOCIAL_EXPIRED"
              ? { href: home, label: "Start again" }
              : undefined,
      });
      return;
    }
    router.replace(result.next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        minLength={2}
        maxLength={60}
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        value={form.email}
        onChange={(e) => set("email")(e.target.value)}
      />
      <TextField
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(555) 123-4567"
        value={form.phone}
        onChange={(e) => set("phone")(e.target.value)}
      />
      <TextField
        label="ZIP code (optional)"
        name="zip"
        autoComplete="postal-code"
        inputMode="numeric"
        maxLength={10}
        pattern="\d{5}(-\d{4})?"
        title="A 5 digit ZIP code"
        value={form.zip}
        onChange={(e) => set("zip")(e.target.value)}
      />
      <RoundsSelect value={form.rounds} onChange={set("rounds")} />
      <Honeypot value={form.website} onChange={set("website")} />

      {error && (
        <div className="space-y-2">
          <ErrorAlert>{error.text}</ErrorAlert>
          {error.link && (
            <Link href={error.link.href} className="inline-block text-sm font-semibold text-fairway-700 underline dark:text-fairway-100">
              {error.link.label}
            </Link>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white transition-colors hover:bg-fairway-600 disabled:opacity-60"
      >
        {busy ? "One moment…" : "Join the waitlist"}
      </button>
      <LegalNote />
    </form>
  );
}
