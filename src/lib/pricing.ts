// Checkout math, modeled on GolfNow's receipt: green fees per golfer, a per-golfer
// convenience fee, sales tax unless the course includes it, and optional Tee Time
// Protection. Prepaid rates (every Hot Deal) charge everything online; pay-at-course
// rates charge only the platform's fees online and the green fees at the pro shop.

export type PaymentMode = "PREPAID" | "PAY_AT_COURSE";

export const HOLD_MINUTES = 5;
export const MAX_PLAYERS = 4;
export const PROTECTION_PER_PLAYER_CENTS = 300;

export interface PriceInput {
  players: number;
  greenFeeCents: number;
  paymentMode: PaymentMode;
  convenienceFeeCents: number;
  taxRateBps: number;
  taxIncluded: boolean;
  withProtection: boolean;
}

export interface PriceBreakdown {
  players: number;
  greenFeeTotalCents: number;
  convenienceFeeCents: number;
  taxCents: number;
  protectionCents: number;
  dueOnlineCents: number;
  dueAtCourseCents: number;
  totalCents: number;
}

/** Tee Time Protection is sold only on prepaid rates; pay-at-course rounds follow the course's own policy. */
export function protectionAvailable(paymentMode: PaymentMode): boolean {
  return paymentMode === "PREPAID";
}

export function priceBooking(input: PriceInput): PriceBreakdown {
  const { players } = input;
  if (!Number.isInteger(players) || players < 1 || players > MAX_PLAYERS) {
    throw new Error(`players must be between 1 and ${MAX_PLAYERS}`);
  }
  const greenFeeTotalCents = input.greenFeeCents * players;
  const convenienceFeeCents = input.convenienceFeeCents * players;
  const taxCents = input.taxIncluded ? 0 : Math.round((greenFeeTotalCents * input.taxRateBps) / 10_000);
  const protectionCents =
    input.withProtection && protectionAvailable(input.paymentMode) ? PROTECTION_PER_PLAYER_CENTS * players : 0;

  const courseShare = greenFeeTotalCents + taxCents;
  const platformShare = convenienceFeeCents + protectionCents;
  const prepaid = input.paymentMode === "PREPAID";

  return {
    players,
    greenFeeTotalCents,
    convenienceFeeCents,
    taxCents,
    protectionCents,
    dueOnlineCents: platformShare + (prepaid ? courseShare : 0),
    dueAtCourseCents: prepaid ? 0 : courseShare,
    totalCents: courseShare + platformShare,
  };
}
