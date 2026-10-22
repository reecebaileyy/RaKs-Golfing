/** "just now", "5m ago", "2h ago", "3d ago", then a short date. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
}
