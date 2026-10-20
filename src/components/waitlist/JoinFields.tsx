// Pieces shared by the waitlist sign-up forms (the landing page card and the social finish step).

import Link from "next/link";
import { ROUNDS_PER_MONTH } from "@/lib/waitlistMath";

export const inputClass = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600";

export function TextField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

export function RoundsSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">How often do you play?</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Pick one</option>
        {ROUNDS_PER_MONTH.map((r) => (
          <option key={r} value={r}>
            {`${r} rounds a month`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A field people never see. Bots fill it in, and the server drops those sign-ups. */
export function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" className="sr-only">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {children}
    </p>
  );
}

export function LegalNote() {
  return (
    <p className="text-xs leading-relaxed text-muted">
      By joining you agree to our{" "}
      <Link href="/terms" className="underline">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline">
        Privacy Policy
      </Link>
      , and that we can email or text you about launch. Reply STOP to opt out of texts.
    </p>
  );
}

export type JoinResult = { ok: true; next: string } | { ok: false; error: string; code: string | null };

/** Posts a sign-up. Never throws: network trouble comes back as an error message. */
export async function postJoin(body: Record<string, unknown>): Promise<JoinResult> {
  try {
    const res = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, next: typeof data.next === "string" ? data.next : window.location.pathname };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Something went wrong. Try again.",
      code: typeof data.code === "string" ? data.code : null,
    };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again.", code: null };
  }
}
