import type { LiveView } from "@/lib/live";

const first = (name: string) => name.trim().split(/\s+/)[0];

/** Status lines per pairing, nine point totals and presses. Renders nothing the golf math couldn't produce. */
export function LiveStatus({ view }: { view: LiveView }) {
  const thru = view.holesCompleted;
  const netLabel = view.scoring === "NET" ? "net" : "gross";
  return (
    <section aria-label="Match status" className="card space-y-2 p-4">
      <div className="flex items-baseline justify-between text-sm text-muted">
        <span>{view.formatLabel} · {netLabel}</span>
        <span>{thru === 0 ? "Not started" : thru >= 18 ? "Final" : `Thru ${thru}`}</span>
      </div>
      {view.pairings?.map((p, i) => (
        <p key={i} className="text-2xl font-extrabold leading-tight">
          {view.pairings!.length > 1 && <span className="mb-0.5 block text-sm font-medium text-muted">{p.names[0]} vs {p.names[1]}</span>}
          {p.summary}
        </p>
      ))}
      {view.ninePoint && (
        <ul className="grid grid-cols-3 gap-2 text-center">
          {view.ninePoint.map((p) => (
            <li key={p.name} className="rounded-xl bg-fairway-50 py-2 text-fairway-900 dark:bg-fairway-900 dark:text-fairway-50">
              <div className="text-3xl font-extrabold">{p.points}</div>
              <div className="text-xs">{p.name}</div>
            </li>
          ))}
        </ul>
      )}
      <ul className="grid gap-1 text-sm" aria-label="Running totals">
        {view.players.map((p) => (
          <li key={p.userId} className="flex justify-between">
            <span>{first(p.name)}</span>
            <span className="font-semibold tabular-nums">
              {p.holesPlayed === 0 ? "-" : view.scoring === "NET" ? `${p.netTotal} net (${p.grossTotal} gross)` : `${p.grossTotal}`}
              <span className="font-normal text-muted"> · {p.holesPlayed} holes</span>
            </span>
          </li>
        ))}
      </ul>
      {view.presses.length > 0 && (
        <ul className="space-y-1 border-t border-line pt-2 text-sm" aria-label="Presses">
          {view.presses.map((p, i) => (
            <li key={i}>
              <span className="font-bold text-flame">ALOHA PRESS</span> on {p.holeNumber}: {p.callerSide} vs {p.opponentSide}
              {p.outcome && <span className="text-muted"> · {pressWords[p.outcome] ?? p.outcome}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const pressWords: Record<string, string> = { WON: "won, bets washed", TIED: "tied, match stands", LOST: "lost, pays double", MOOT: "moot" };

/** The 18-hole grid: gross big, net small underneath on net matches, front/back/total rows. */
export function LiveGrid({ view }: { view: LiveView }) {
  const net = view.scoring === "NET";
  const sums = (p: LiveView["players"][number], idx: number[]) => {
    const g = idx.map((i) => p.gross[i]);
    const n = idx.map((i) => p.net[i]);
    const done = g.every((x) => x != null);
    return {
      gross: g.reduce<number>((a, b) => a + (b ?? 0), 0),
      net: n.reduce<number>((a, b) => a + (b ?? 0), 0),
      any: g.some((x) => x != null),
      done,
    };
  };
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  const par = (idx: number[]) => idx.reduce((a, i) => a + (view.holes[i]?.par ?? 0), 0);

  const groups: { label: string; idx: number[] }[] = [
    { label: "Out", idx: range(1, 9) },
    { label: "In", idx: range(10, 18) },
  ];

  const header = (
    <tr className="text-xs text-muted">
      <th className="px-2 py-2 text-left font-medium">Hole</th>
      <th className="px-1 py-2 font-medium">Par</th>
      {view.players.map((p) => (
        <th key={p.userId} className="px-1 py-2 text-center font-semibold text-[var(--foreground)]">{first(p.name)}</th>
      ))}
    </tr>
  );

  function holeRow(i: number) {
    const h = view.holes[i];
    if (!h) return null;
    return (
      <tr key={h.number} className="border-t border-line">
        <th scope="row" className="px-2 py-2 text-left text-base font-bold tabular-nums">
          {h.number}
          <span className="ml-1 text-[10px] font-normal text-muted">SI {h.strokeIndex}</span>
        </th>
        <td className="px-1 text-center tabular-nums text-muted">{h.par}</td>
        {view.players.map((p) => {
          const g = p.gross[i];
          const dots = p.strokesReceived[i] ?? 0;
          const diff = g == null ? 0 : g - h.par;
          return (
            <td key={p.userId} className="px-1 py-1 text-center align-middle">
              <span
                className={`inline-block min-w-8 rounded-full px-1 text-lg font-extrabold tabular-nums ${
                  g == null ? "text-muted" : diff < 0 ? "bg-fairway-100 text-fairway-900" : diff > 0 ? "text-red-700" : ""
                }`}
              >
                {g ?? "·"}
              </span>
              {dots > 0 && <span aria-label={`${dots} stroke${dots > 1 ? "s" : ""} received`} className="ml-0.5 align-top text-flame">{"•".repeat(dots)}</span>}
              {net && g != null && dots > 0 && <span className="block text-[11px] leading-none text-muted">net {g - dots}</span>}
            </td>
          );
        })}
      </tr>
    );
  }

  function totalRow(key: string, label: string, idx: number[], strong = false) {
    return (
      <tr key={key} className={`border-t border-line bg-fairway-50 dark:bg-fairway-900 ${strong ? "text-base" : ""}`}>
        <th scope="row" className="px-2 py-2 text-left font-bold">{label}</th>
        <td className="px-1 text-center tabular-nums text-muted">{par(idx)}</td>
        {view.players.map((p) => {
          const s = sums(p, idx);
          return (
            <td key={p.userId} className="px-1 py-1 text-center font-extrabold tabular-nums">
              {s.any ? s.gross : "-"}
              {net && s.any && <span className="block text-[11px] font-normal leading-none text-muted">net {s.net}</span>}
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full table-fixed text-sm" aria-label="Scorecard">
        <thead>{header}</thead>
        <tbody>
          {range(1, 9).map(holeRow)}
          {totalRow("out", groups[0].label, groups[0].idx)}
          {range(10, 18).map(holeRow)}
          {totalRow("in", groups[1].label, groups[1].idx)}
          {totalRow("tot", "Total", range(1, 18), true)}
        </tbody>
      </table>
    </div>
  );
}
