// Tee times are stored in UTC and always shown in the course's own time zone.

export function formatTeeTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTeeDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date);
}

/** Offset in minutes between UTC and `timeZone` at `at` (positive east of UTC). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** UTC instant for a wall-clock time in `timeZone`. */
export function zonedTime(ymd: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute));
  const offset = zoneOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check once in case the guess straddled a DST change.
  const offset2 = zoneOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** [start, end) of a calendar day in `timeZone`. */
export function zonedDayRange(ymd: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedTime(ymd, 0, 0, timeZone);
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start, end: zonedTime(next, 0, 0, timeZone) };
}

/** Today's date (YYYY-MM-DD) in `timeZone`. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Local hour (0-23) of `date` in `timeZone`. */
export function hourIn(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date));
}

export type TimeOfDay = "morning" | "midday" | "twilight";

export function timeOfDay(date: Date, timeZone: string): TimeOfDay {
  const h = hourIn(date, timeZone);
  if (h < 11) return "morning";
  if (h < 15) return "midday";
  return "twilight";
}
