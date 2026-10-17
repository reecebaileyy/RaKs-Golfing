"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CourseOption } from "@/lib/profileData";
import { GhinFields, parseIndex } from "./GhinFields";
import { ScoreCardForm } from "./ScoreCardForm";

const ROUNDS_NEEDED = 5;
const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600";

/** After sign up: GHIN number, or five score cards. Home course and state are optional. */
export function ProfileOnboarding({ courses, next, existingCards }: { courses: CourseOption[]; next: string; existingCards: number }) {
  const router = useRouter();
  const [path, setPath] = useState<"ghin" | "rounds" | null>(null);
  const [homeCourseId, setHomeCourseId] = useState("");
  const [state, setState] = useState("");
  const [ghin, setGhin] = useState({ ghinNumber: "", ghinIndex: "" });
  const [saved, setSaved] = useState(existingCards);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setBusy(false);
      setError((await res.json()).error);
      return false;
    }
    setBusy(false);
    return true;
  }

  const about = { homeCourseId: homeCourseId || null, state: state || null };

  async function startRounds() {
    if (await patch(about)) setPath("rounds");
  }

  async function submitGhin(e: React.FormEvent) {
    e.preventDefault();
    const idx = parseIndex(ghin.ghinIndex);
    if (idx === null) return setError("Enter your current index as shown in your GHIN app.");
    if (await patch({ ...about, ghinNumber: ghin.ghinNumber, ghinIndex: idx })) done();
  }

  if (path === "rounds") {
    const current = Math.min(saved + 1, ROUNDS_NEEDED);
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-fairway-700" data-testid="round-progress">Round {current} of {ROUNDS_NEEDED}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-fairway-100">
            <div className="h-full bg-fairway-600" style={{ width: `${(saved / ROUNDS_NEEDED) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">Enter your {ROUNDS_NEEDED} most recent 18-hole rounds, one at a time.</p>
        </div>
        <ScoreCardForm
          courses={courses}
          defaultCourseId={homeCourseId}
          submitLabel={saved + 1 >= ROUNDS_NEEDED ? "Save and finish" : "Save and add next round"}
          onSaved={() => {
            if (saved + 1 >= ROUNDS_NEEDED) done();
            else setSaved(saved + 1);
          }}
        />
        <button type="button" onClick={done} className="w-full text-center text-sm text-muted underline">
          Finish later
        </button>
      </div>
    );
  }

  if (path === "ghin") {
    return (
      <form onSubmit={submitGhin} className="space-y-4">
        <button type="button" onClick={() => setPath(null)} className="text-sm text-muted underline">Back</button>
        <GhinFields value={ghin} onChange={setGhin} />
        <p className="rounded-xl bg-fairway-50 p-3 text-sm dark:bg-fairway-900/40">
          You can play matches right away. The Verified badge appears once we check your GHIN number and you&apos;ve entered a round.
        </p>
        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy || !ghin.ghinNumber} className="w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Home course <span className="text-muted">(optional)</span></span>
          <select value={homeCourseId} onChange={(e) => setHomeCourseId(e.target.value)} className={input}>
            <option value="">Skip</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Home state <span className="text-muted">(optional)</span></span>
          <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="CA" autoCapitalize="characters" className={input} />
        </label>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="space-y-3">
        <button type="button" onClick={() => setPath("ghin")} className="w-full rounded-xl bg-fairway-700 px-5 py-4 text-left font-semibold text-white">
          I have a GHIN number
          <span className="block text-sm font-normal text-white/80">Fastest. Add your number and current index.</span>
        </button>
        <button type="button" onClick={startRounds} disabled={busy} className="w-full rounded-xl border border-line bg-card px-5 py-4 text-left font-semibold disabled:opacity-60">
          Enter my last 5 rounds
          <span className="block text-sm font-normal text-muted">No GHIN? We&apos;ll work out your handicap from your scores.</span>
        </button>
      </div>
      <button type="button" onClick={done} className="w-full text-center text-sm text-muted underline">
        Skip for now
      </button>
    </div>
  );
}
