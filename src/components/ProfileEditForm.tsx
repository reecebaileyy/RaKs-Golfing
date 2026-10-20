"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GhinFields, parseIndex } from "./GhinFields";

interface Props {
  courses: { id: string; name: string }[];
  initial: { name: string; homeCourseId: string | null; state: string | null; ghinNumber: string | null; ghinIndex: number | null };
}

/** Edit name, home course, state and GHIN details. Changing the GHIN number clears the verification. */
export function ProfileEditForm({ courses, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial.name);
  const [homeCourseId, setHomeCourseId] = useState(initial.homeCourseId ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [ghin, setGhin] = useState({
    ghinNumber: initial.ghinNumber ?? "",
    ghinIndex: initial.ghinIndex === null ? "" : initial.ghinIndex < 0 ? `+${Math.abs(initial.ghinIndex)}` : String(initial.ghinIndex),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl border border-line px-5 py-3 text-sm font-semibold">
        Edit profile
      </button>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        homeCourseId: homeCourseId || null,
        state: state || null,
        ghinNumber: ghin.ghinNumber || null,
        ghinIndex: ghin.ghinNumber ? parseIndex(ghin.ghinIndex) : null,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      setError((await res.json()).error);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600";
  return (
    <form onSubmit={save} className="card space-y-4 p-4">
      <h2 className="font-semibold">Edit profile</h2>
      <label className="block">
        <span className="mb-1 block text-sm">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Home course</span>
        <select value={homeCourseId} onChange={(e) => setHomeCourseId(e.target.value)} className={input}>
          <option value="">None</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">State</span>
        <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="CA" autoCapitalize="characters" className={input} />
      </label>
      <GhinFields value={ghin} onChange={setGhin} />
      {ghin.ghinNumber !== (initial.ghinNumber ?? "") && initial.ghinNumber && (
        <p className="text-sm text-muted">Changing your GHIN number removes your verified badge until it&apos;s checked again.</p>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-fairway-700 px-5 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-5 py-3 font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
