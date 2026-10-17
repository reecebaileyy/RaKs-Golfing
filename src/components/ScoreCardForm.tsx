"use client";

import { useRef, useState } from "react";
import type { CourseOption } from "@/lib/profileData";
import { holeStrokesError, toPar } from "@/lib/stats";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/** Course, tees, date and 18 numeric hole inputs. Saves through /api/scorecards and calls onSaved. */
export function ScoreCardForm({
  courses,
  defaultCourseId,
  submitLabel = "Save score card",
  onSaved,
}: {
  courses: CourseOption[];
  defaultCourseId?: string | null;
  submitLabel?: string;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState(courses.find((c) => c.id === defaultCourseId)?.id ?? courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [teeSetId, setTeeSetId] = useState(course?.teeSets[0]?.id ?? "");
  const [date, setDate] = useState(localToday());
  const [strokes, setStrokes] = useState<(number | null)[]>(Array(18).fill(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const pars = course?.holes.map((h) => h.par) ?? [];
  const front = strokes.slice(0, 9);
  const back = strokes.slice(9);
  const total = sum(strokes);
  const parTotal = pars.reduce((a, b) => a + b, 0);

  function pickCourse(id: string) {
    setCourseId(id);
    setTeeSetId(courses.find((c) => c.id === id)?.teeSets[0]?.id ?? "");
  }

  function setHole(i: number, text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    const next = [...strokes];
    next[i] = digits ? Number(digits) : null;
    setStrokes(next);
    // A single digit from 2 to 9, or two digits, means the score is complete: jump to the next hole.
    if (digits && (digits.length === 2 || Number(digits) >= 2) && i < 17) inputs.current[i + 1]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = holeStrokesError(strokes);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/scorecards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId, teeSetId, date, strokes }),
    });
    if (!res.ok) {
      setBusy(false);
      setError((await res.json()).error);
      return;
    }
    setStrokes(Array(18).fill(null));
    setBusy(false);
    onSaved();
  }

  const nine = (start: number, label: string, part: (number | null)[]) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        <span>Par {sum(pars.slice(start, start + 9))} · Score {sum(part) || "–"}</span>
      </div>
      <div className="grid grid-cols-9 gap-1">
        {part.map((v, k) => {
          const i = start + k;
          return (
            <label key={i} className="block text-center">
              <span className="block text-[10px] text-muted">{i + 1}</span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                aria-label={`Hole ${i + 1}`}
                inputMode="numeric"
                autoComplete="off"
                value={v ?? ""}
                onChange={(e) => setHole(i, e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-11 w-full rounded-lg border border-line bg-card px-0 text-center text-base font-semibold outline-none focus:border-fairway-600"
              />
              <span className="block text-[10px] text-muted">par {pars[i] ?? "–"}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm">Course</span>
        <select value={courseId} onChange={(e) => pickCourse(e.target.value)} className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm">Tees</span>
          <select value={teeSetId} onChange={(e) => setTeeSetId(e.target.value)} className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base">
            {course?.teeSets.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.courseRating}/{t.slope})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Date played</span>
          <input type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} required className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base" />
        </label>
      </div>
      {nine(0, "Front", front)}
      {nine(9, "Back", back)}
      <p className="text-center text-sm" data-testid="card-total">
        Total <span className="text-lg font-bold">{total || "–"}</span>
        {total > 0 && parTotal > 0 && <span className="text-muted"> ({toPar(total, parTotal)})</span>}
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-fairway-700 px-5 py-4 font-semibold text-white disabled:opacity-60">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
