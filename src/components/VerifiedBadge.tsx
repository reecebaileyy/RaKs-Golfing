// The check-mark badge shown next to verified golfers. Safe in server and client components.
export function VerifiedBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      data-testid="verified-badge"
      title="GHIN checked and rounds entered"
      className={`inline-flex items-center gap-1 rounded-full bg-fairway-100 font-semibold text-fairway-900 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden className={small ? "h-3 w-3" : "h-4 w-4"}>
        <circle cx="10" cy="10" r="10" fill="currentColor" className="text-fairway-600" />
        <path d="M5.5 10.5l3 3 6-7" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  );
}

/** Tag for a golfer who is not verified: says what their handicap rests on. */
export function HandicapSourceTag({ source, hasGhin }: { source: "NONE" | "APP" | "GHIN"; hasGhin: boolean }) {
  const label = hasGhin ? "GHIN on file" : source === "APP" ? "App handicap" : "No handicap yet";
  return <span className="inline-flex rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted dark:bg-white/10">{label}</span>;
}
