import { sparklinePoints } from "@/lib/stats";

/** Tiny inline trend line of score differentials, oldest to newest. */
export function ProfileSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="text-sm text-muted">Enter at least 2 rounds to see a trend.</p>;
  const w = 280;
  const h = 56;
  const points = sparklinePoints(values, w, h);
  const last = points.split(" ").pop()!.split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Differential trend over ${values.length} rounds`} className="h-14 w-full">
      <polyline points={points} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-fairway-600" />
      <circle cx={last[0]} cy={last[1]} r="4" className="fill-flame" />
    </svg>
  );
}
