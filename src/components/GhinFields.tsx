"use client";

export interface GhinValues {
  ghinNumber: string;
  ghinIndex: string;
}

/** GHIN number + current index. Used by onboarding and profile editing. */
export function GhinFields({ value, onChange }: { value: GhinValues; onChange: (v: GhinValues) => void }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm">GHIN number</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.ghinNumber}
          onChange={(e) => onChange({ ...value, ghinNumber: e.target.value.replace(/\D/g, "") })}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Current Handicap Index (as shown in your GHIN app)</span>
        <input
          inputMode="decimal"
          value={value.ghinIndex}
          onChange={(e) => onChange({ ...value, ghinIndex: e.target.value.replace(/[^0-9.+-]/g, "") })}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
        />
      </label>
    </div>
  );
}

/** Plus handicaps show as "+1.2" in GHIN and are stored as -1.2. */
export function parseIndex(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t.startsWith("+") ? `-${t.slice(1)}` : t);
  return Number.isFinite(n) ? n : null;
}
