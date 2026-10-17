"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export interface DateOption {
  ymd: string;
  weekday: string;
  day: string;
}

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
        active ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"
      }`}
    >
      {children}
    </button>
  );
}

export function SearchFilters({ dates }: { dates: DateOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Filters update optimistically: the URL only changes once the new results arrive,
  // so quick taps in a row build on this instead of on the URL.
  const [query, setQuery] = useState(params.toString());
  useEffect(() => setQuery(params.toString()), [params]);

  const selected = new URLSearchParams(query);
  const current = {
    date: selected.get("date") ?? dates[0].ymd,
    players: selected.get("players") ?? "",
    holes: selected.get("holes") ?? "",
    time: selected.get("time") ?? "",
    hotDeals: selected.get("hotDeals") === "1",
  };

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(query);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setQuery(next.toString());
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Course or city"
          aria-label="Search by course or city"
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
        />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Date">
        {dates.map((d) => (
          <button
            key={d.ymd}
            type="button"
            aria-pressed={current.date === d.ymd}
            onClick={() => update({ date: d.ymd })}
            className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 ${
              current.date === d.ymd ? "border-fairway-700 bg-fairway-700 text-white" : "border-line bg-card"
            }`}
          >
            <span className="text-xs uppercase">{d.weekday}</span>
            <span className="text-lg font-semibold">{d.day}</span>
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Golfers">
        {["", "1", "2", "3", "4"].map((n) => (
          <Chip key={n} active={current.players === n} onClick={() => update({ players: n || null })} label={n ? `${n} golfers` : "Any number of golfers"}>
            {n ? `${n} ${n === "1" ? "golfer" : "golfers"}` : "Any golfers"}
          </Chip>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[
          ["", "Any holes"],
          ["18", "18 holes"],
          ["9", "9 holes"],
        ].map(([v, label]) => (
          <Chip key={v} active={current.holes === v} onClick={() => update({ holes: v || null })}>
            {label}
          </Chip>
        ))}
        <span className="w-px shrink-0 bg-[var(--line)]" />
        {[
          ["morning", "Morning"],
          ["midday", "Midday"],
          ["twilight", "Twilight"],
        ].map(([v, label]) => (
          <Chip key={v} active={current.time === v} onClick={() => update({ time: current.time === v ? null : v })}>
            {label}
          </Chip>
        ))}
        <Chip active={current.hotDeals} onClick={() => update({ hotDeals: current.hotDeals ? null : "1" })}>
          <span className={current.hotDeals ? "" : "text-flame"}>🔥</span> Hot Deals
        </Chip>
      </div>
    </div>
  );
}
