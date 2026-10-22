"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COMMENT_MAX } from "@/lib/waitlistMath";
import { ErrorAlert, inputClass } from "./JoinFields";

/** Posts one take to the golf talk wall. */
export function CommentForm() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const left = COMMENT_MAX - body.length;
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm">Your golf take</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={COMMENT_MAX}
          rows={3}
          placeholder="Best round, worst hole, home course..."
          className={`${inputClass} resize-y`}
        />
      </label>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${left <= 20 ? "font-semibold text-flame" : "text-muted"}`} aria-live="polite">
          {body.length}/{COMMENT_MAX}
        </span>
        <button
          type="submit"
          disabled={busy || body.trim().length < 2}
          className="rounded-xl bg-fairway-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-fairway-600 disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
