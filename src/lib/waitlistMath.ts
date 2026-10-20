// Pure helpers for the waitlist: names on the comment wall, comment rules, the demand numbers and the CSV.
// No database here, so all of it is unit tested.

import { todayIn, addDays } from "./time";

export const JOIN_METHODS = ["email", "phone", "x", "tiktok", "instagram"] as const;
export type JoinMethod = (typeof JOIN_METHODS)[number];

export const ROUNDS_PER_MONTH = ["0-1", "2-4", "5+"] as const;
export type RoundsPerMonth = (typeof ROUNDS_PER_MONTH)[number];

export const METHOD_LABEL: Record<JoinMethod, string> = {
  email: "Email",
  phone: "Phone",
  x: "X",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export const COMMENT_MAX = 280;

/** "Maya Rodriguez" -> "Maya R."; one-word names stay as they are. */
export function publicName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A golfer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** The cleaned comment, or the reason it can't be posted. */
export function checkComment(body: string): { ok: true; body: string } | { ok: false; reason: string } {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length < 2) return { ok: false, reason: "Say a little more." };
  if (clean.length > COMMENT_MAX) return { ok: false, reason: `Keep it under ${COMMENT_MAX} characters.` };
  // Links are how wall spam gets in; golf talk doesn't need them.
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|ru|info)\b)/i.test(clean)) {
    return { ok: false, reason: "Links aren't allowed on the wall." };
  }
  return { ok: true, body: clean };
}

/** US ZIP (5 digits, or ZIP+4 cut to 5), or null. */
export function normalizeZip(input: string | null | undefined): string | null {
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(input ?? "");
  return m ? m[1] : null;
}

export interface EntryRow {
  createdAt: Date;
  method: string;
  zip: string | null;
  roundsPerMonth: string | null;
  utmSource: string | null;
  referredById: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface WaitlistStats {
  total: number;
  today: number;
  last7: number;
  referred: number;
  withEmail: number;
  withPhone: number;
  byMethod: { method: string; count: number }[];
  bySource: { source: string; count: number }[];
  byRounds: { rounds: string; count: number }[];
  topZips: { zip: string; count: number }[];
  daily: { date: string; count: number }[];
}

function tally<T extends string>(keys: T[]): { key: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Where a sign-up came from: its utm_source, else "referral" when a friend's link brought them, else "direct". */
export const sourceOf = (e: Pick<EntryRow, "utmSource" | "referredById">) => e.utmSource?.toLowerCase() || (e.referredById ? "referral" : "direct");

/** The demand numbers for the dashboard. `days` of daily counts, oldest first, in `timeZone`. */
export function summarize(rows: EntryRow[], opts: { now: Date; timeZone: string; days: number }): WaitlistStats {
  const today = todayIn(opts.timeZone, opts.now);
  const weekAgo = addDays(today, -6);
  const firstDay = addDays(today, -(opts.days - 1));
  const dayOf = (d: Date) => todayIn(opts.timeZone, d);
  const days = rows.map((r) => dayOf(r.createdAt));

  const perDay = new Map<string, number>();
  for (const d of days) if (d >= firstDay) perDay.set(d, (perDay.get(d) ?? 0) + 1);

  return {
    total: rows.length,
    today: days.filter((d) => d === today).length,
    last7: days.filter((d) => d >= weekAgo).length,
    referred: rows.filter((r) => r.referredById).length,
    withEmail: rows.filter((r) => r.hasEmail).length,
    withPhone: rows.filter((r) => r.hasPhone).length,
    byMethod: tally(rows.map((r) => r.method)).map(({ key, count }) => ({ method: key, count })),
    bySource: tally(rows.map(sourceOf)).map(({ key, count }) => ({ source: key, count })),
    byRounds: tally(rows.map((r) => r.roundsPerMonth ?? "not given")).map(({ key, count }) => ({ rounds: key, count })),
    topZips: tally(rows.flatMap((r) => (r.zip ? [r.zip] : [])))
      .slice(0, 10)
      .map(({ key, count }) => ({ zip: key, count })),
    daily: Array.from({ length: opts.days }, (_, i) => {
      const date = addDays(firstDay, i);
      return { date, count: perDay.get(date) ?? 0 };
    }),
  };
}

/** One CSV cell. Quotes when needed, and defuses values a spreadsheet would run as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");
