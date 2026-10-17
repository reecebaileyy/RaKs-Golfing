"use client";

import { formatCents } from "@/lib/money";
import { MAX_STAKE_CENTS, POINT_VALUES } from "@/lib/wagers/constants";

export type FormatValue =
  | "SINGLES_STROKE"
  | "SINGLES_MATCH"
  | "FOURBALL_STROKE"
  | "FOURBALL_MATCH"
  | "NINE_POINT"
  | "THREESOME_STROKE"
  | "THREESOME_MATCH";

export interface FormatOption {
  value: FormatValue;
  label: string;
  players: number;
}

export interface TeeSetOption {
  id: string;
  name: string;
  courseRating: number;
  slope: number;
  yards: number | null;
}

export interface MatchSetupValue {
  format: FormatValue | null;
  scoring: "NET" | "GROSS";
  stakeDollars: string;
  teeSetId: string;
  isOpenChallenge: boolean;
  pointVoteCents: number;
}

const FORMAT_HINT: Record<FormatValue, string> = {
  SINGLES_STROKE: "Lowest total score wins.",
  SINGLES_MATCH: "Win the most holes.",
  FOURBALL_STROKE: "Teams of two, best ball on each hole, lowest total.",
  FOURBALL_MATCH: "Teams of two, best ball wins the hole.",
  NINE_POINT: "Three players, 5-3-1 points every hole.",
  THREESOME_STROKE: "Three players, each pair is its own stroke play match.",
  THREESOME_MATCH: "Three players, each pair is its own match play match.",
};

const heading = "mb-2 text-sm font-semibold uppercase tracking-wide text-muted";

function Choice({ checked, onClick, disabled, children, label }: { checked: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`card w-full p-4 text-left disabled:opacity-40 ${checked ? "!border-fairway-700 ring-2 ring-fairway-700/20" : ""}`}
    >
      {children}
    </button>
  );
}

/** The Match step of checkout: format, net or gross, stake, tees and who can join. */
export function MatchSetupFields({
  value,
  onChange,
  formats,
  teeSets,
  players,
  minStakeCents,
}: {
  value: MatchSetupValue;
  onChange: (v: MatchSetupValue) => void;
  formats: FormatOption[];
  teeSets: TeeSetOption[];
  players: number;
  minStakeCents: number;
}) {
  const set = (patch: Partial<MatchSetupValue>) => onChange({ ...value, ...patch });
  const ninePoint = value.format === "NINE_POINT";

  return (
    <div className="space-y-5">
      <section>
        <h2 className={heading}>Format</h2>
        <div className="space-y-2" role="radiogroup" aria-label="Format">
          {formats.map((f) => (
            <Choice key={f.value} checked={value.format === f.value} disabled={f.players !== players} onClick={() => set({ format: f.value })} label={f.label}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{f.label}</span>
                <span className="shrink-0 text-xs text-muted">{f.players} golfers</span>
              </span>
              <span className="block text-sm text-muted">{FORMAT_HINT[f.value]}</span>
            </Choice>
          ))}
        </div>
      </section>

      <section>
        <h2 className={heading}>Scoring</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Scoring">
          {(["NET", "GROSS"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={value.scoring === s}
              onClick={() => set({ scoring: s })}
              className={`rounded-xl border py-3 font-semibold ${value.scoring === s ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"}`}
            >
              {s === "NET" ? "Net" : "Gross"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {value.scoring === "NET" ? "Handicap strokes are given off the low player." : "No strokes: every shot counts the same."} Everyone agrees to this before they join.
        </p>
      </section>

      <section>
        <h2 className={heading}>{ninePoint ? "Most you can lose" : "Wager per player"}</h2>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 focus-within:border-fairway-600">
          <span className="text-lg font-semibold">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={minStakeCents / 100}
            max={MAX_STAKE_CENTS / 100}
            step={1}
            aria-label={ninePoint ? "Most you can lose" : "Wager"}
            value={value.stakeDollars}
            onChange={(e) => set({ stakeDollars: e.target.value })}
            className="w-full bg-transparent text-lg font-semibold outline-none"
          />
        </label>
        <div className="mt-2 flex gap-2">
          {[20, 50, 100].map((d) => (
            <button key={d} type="button" onClick={() => set({ stakeDollars: String(d) })} className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium">
              ${d}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Minimum {formatCents(minStakeCents)}.{" "}
          {ninePoint
            ? "Each pair settles the point difference; nobody loses more than this."
            : value.format?.startsWith("THREESOME")
              ? "You play each of the other two for this amount."
              : "Loser pays the winner. No cut is taken."}
        </p>
      </section>

      {ninePoint && (
        <section>
          <h2 className={heading}>Your vote: per point</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Point value vote">
            {POINT_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={value.pointVoteCents === v}
                onClick={() => set({ pointVoteCents: v })}
                className={`rounded-xl border py-3 font-semibold ${value.pointVoteCents === v ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"}`}
              >
                {formatCents(v).replace(".00", "")}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">The group votes. Majority wins; three different votes means the lowest.</p>
        </section>
      )}

      <section>
        <h2 className={heading}>Tees</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tees">
          {teeSets.map((t) => (
            <Choice key={t.id} checked={value.teeSetId === t.id} onClick={() => set({ teeSetId: t.id })} label={`${t.name} tees`}>
              <span className="block font-semibold">{t.name}</span>
              <span className="block text-xs text-muted">
                {t.courseRating.toFixed(1)} / {t.slope}
                {t.yards ? ` · ${t.yards.toLocaleString("en-US")} yds` : ""}
              </span>
            </Choice>
          ))}
        </div>
      </section>

      <section>
        <h2 className={heading}>Opponents</h2>
        <div className="space-y-2" role="radiogroup" aria-label="Opponents">
          <Choice checked={!value.isOpenChallenge} onClick={() => set({ isOpenChallenge: false })} label="Invite friends">
            <span className="block font-semibold">Invite friends</span>
            <span className="block text-sm text-muted">You get a link to share. Only people with it can join.</span>
          </Choice>
          <Choice checked={value.isOpenChallenge} onClick={() => set({ isOpenChallenge: true })} label="Open challenge">
            <span className="block font-semibold">Open challenge</span>
            <span className="block text-sm text-muted">Anyone can join from the Matches tab. You still get a link.</span>
          </Choice>
        </div>
        <p className="mt-2 text-xs text-muted">If nobody joins by 2 hours before the tee time, your wager comes back and you keep the tee time.</p>
      </section>
    </div>
  );
}
