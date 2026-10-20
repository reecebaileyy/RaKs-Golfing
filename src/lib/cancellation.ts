// Cancellation rules, modeled on GolfNow:
// - Cancel at least `cancelWindowHours` (24 by default) before the tee time and the
//   prepaid green fees and tax come back. The convenience fee is kept.
// - Tee Time Protection extends that cutoff to 1 hour before the tee time.
// - Later than that the round can still be released, but nothing is refunded.
// - Once the tee time has passed the reservation can't be cancelled.

export const PROTECTION_CUTOFF_HOURS = 1;

export interface CancelInput {
  startsAt: Date;
  now: Date;
  cancelWindowHours: number;
  hasProtection: boolean;
  /** What was charged online for green fees and tax (0 for pay-at-course). */
  prepaidCourseCents: number;
}

export type CancelQuote =
  | { allowed: false; reason: string }
  | { allowed: true; refundCents: number; refundable: boolean; deadline: Date };

const HOUR = 3_600_000;

export function quoteCancellation(input: CancelInput): CancelQuote {
  const { startsAt, now } = input;
  if (now.getTime() >= startsAt.getTime()) {
    return { allowed: false, reason: "This tee time has already started." };
  }
  const windowHours = input.hasProtection ? PROTECTION_CUTOFF_HOURS : input.cancelWindowHours;
  const deadline = new Date(startsAt.getTime() - windowHours * HOUR);
  const refundable = now.getTime() <= deadline.getTime();
  return { allowed: true, refundable, refundCents: refundable ? input.prepaidCourseCents : 0, deadline };
}
