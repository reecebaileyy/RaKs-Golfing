// Small inline check shown next to verified golfers' names on the leaderboard.
export function LeaderboardVerifiedBadge() {
  return (
    <span
      role="img"
      aria-label="Verified"
      title="Verified: GHIN checked and rounds entered"
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-fairway-600 text-white"
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M4 8.5l2.5 2.5L12 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
