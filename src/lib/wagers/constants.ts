// Wager limits safe to import from client components (no database imports here).

export const MAX_STAKE_CENTS = 100_000;
/** NINE_POINT: the values a player can vote for, per point. */
export const POINT_VALUES = [100, 300, 500] as const;
/** Open matches still missing players this close to the tee time are voided. */
export const SWEEP_HOURS = 2;
