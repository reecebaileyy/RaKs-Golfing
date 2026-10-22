// Email and phone handling for accounts that sign in without a password.
// Phones are stored in E.164 (+15551234567); bare 10 digit numbers are read as US numbers.

import { z } from "zod";

export type ContactKind = "email" | "phone";

const Email = z.string().trim().toLowerCase().email();

/** Lower-cased email, or null when it isn't one. */
export function normalizeEmail(input: string): string | null {
  const parsed = Email.safeParse(input);
  return parsed.success && parsed.data.length <= 254 ? parsed.data : null;
}

/** E.164 phone number, or null when it can't be one. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;
  // Country codes never start with 0; E.164 allows at most 15 digits.
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  // North American numbers: area code and exchange can't start with 0 or 1.
  if (e164.startsWith("+1") && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(e164)) return null;
  return e164;
}

/** Reads one box that takes either an email or a phone number. */
export function parseContact(input: string): { kind: ContactKind; value: string } | null {
  if (input.includes("@")) {
    const email = normalizeEmail(input);
    return email ? { kind: "email", value: email } : null;
  }
  const phone = normalizePhone(input);
  return phone ? { kind: "phone", value: phone } : null;
}

/** Shows enough of a contact to recognise it: r•••@example.com, •••• 4567. */
export function maskContact(kind: ContactKind, value: string): string {
  if (kind === "phone") return `•••• ${value.slice(-4)}`;
  const [name, domain] = value.split("@");
  return `${name.slice(0, 1)}•••@${domain}`;
}

/** "(555) 123-4567" for US numbers, the E.164 form otherwise. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
