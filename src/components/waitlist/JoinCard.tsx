"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert, Honeypot, LegalNote, postJoin, RoundsSelect, TextField } from "./JoinFields";
import { SocialButtons, type ProviderOption } from "./SocialButtons";

type Method = "email" | "phone";

const METHODS: { id: Method; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
];

/** The sign-up card for signed-out visitors: social buttons first, then email or phone. */
export function JoinCard({ providers, home }: { providers: ProviderOption[]; home: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [form, setForm] = useState({ name: "", email: "", phone: "", zip: "", rounds: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; exists: boolean } | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postJoin({
      method,
      name: form.name,
      [method]: form[method],
      zip: form.zip.trim() || undefined,
      roundsPerMonth: form.rounds || undefined,
      website: form.website,
    });
    if (!result.ok) {
      setBusy(false);
      setError({ text: result.error, exists: result.code === "EXISTS" });
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
        <h2 className="text-xl font-bold">Save your spot</h2>
        <p className="text-sm text-muted">Be first in line when matches open near you.</p>
      </div>

      {providers.length > 0 && (
        <>
          <SocialButtons providers={providers} />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--line)]" />
            or
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <span id="signup-with" className="mb-1 block text-sm">
            Sign up with
          </span>
          <div role="radiogroup" aria-labelledby="signup-with" className="grid grid-cols-2 gap-2">
            {METHODS.map(({ id, label }) => (
              <label key={id} className="relative">
                <input
                  type="radio"
                  name="method"
                  value={id}
                  checked={method === id}
                  onChange={() => setMethod(id)}
                  className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="pointer-events-none block rounded-xl border border-line bg-card px-4 py-2.5 text-center text-sm font-semibold peer-checked:border-fairway-700 peer-checked:bg-fairway-700 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fairway-600">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

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
        {method === "email" ? (
          <TextField
            key="email"
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        ) : (
          <TextField
            key="phone"
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 123-4567"
            required
            value={form.phone}
            onChange={(e) => set("phone")(e.target.value)}
          />
        )}
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
            {error.exists && (
              <Link
                href={`/signin?next=${encodeURIComponent(home)}`}
                className="inline-block text-sm font-semibold text-fairway-700 underline dark:text-fairway-100"
              >
                Sign in
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
    </section>
  );
}
