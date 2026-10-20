"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600";

/** Passwordless sign-in: a 6-digit code sent to the account's email or phone. */
export function CodeSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error);
    return res.ok ? data : null;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("/api/auth/code/start", { contact });
    if (!data) return;
    setSentTo(data.sentTo);
    setDevCode(data.devCode ?? null);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!(await post("/api/auth/code/verify", { contact, code }))) return;
    router.replace(next);
    router.refresh();
  }

  const alert = error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  const button = "w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60";

  if (!sentTo) {
    return (
      <form onSubmit={send} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Email or phone number</span>
          <input autoComplete="username" required value={contact} onChange={(e) => setContact(e.target.value)} className={input} />
        </label>
        {alert}
        <button type="submit" disabled={busy} className={button}>{busy ? "One moment…" : "Send me a code"}</button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm">We sent a 6-digit code to <span className="font-medium">{sentTo}</span>.</p>
      {devCode && (
        <p className="rounded-xl border border-line bg-fairway-50 p-3 text-sm text-fairway-900">
          Test mode: no email or text service is set up, so here is the code: <span className="font-mono font-semibold">{devCode}</span>
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm">6-digit code</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${input} font-mono tracking-widest`}
        />
      </label>
      {alert}
      <button type="submit" disabled={busy} className={button}>{busy ? "One moment…" : "Sign in"}</button>
      <button
        type="button"
        onClick={() => {
          setSentTo(null);
          setCode("");
          setError(null);
        }}
        className="w-full text-center text-sm font-medium text-fairway-600"
      >
        Use a different email or number
      </button>
    </form>
  );
}
