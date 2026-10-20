// Tee sheet boundary. Every course's availability lives behind a provider so a course
// we host ourselves and a course on a partner tee sheet (Lightspeed/Chronogolf, foreUP,
// Club Prophet, ...) go through the same booking flow. Our TeeTime/Rate tables act as
// the local copy of the sheet; partner providers keep it in sync and mirror each change
// to the course's real system.

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface TeeSheetProvider {
  /** Refresh our copy of the course's tee times and rates for a day. */
  syncAvailability(courseId: string, date: string): Promise<void>;
  /** Take spots off the sheet for a checkout hold. Resolves false if they're already gone. */
  reserveSpots(tx: Tx, teeTimeId: string, players: number): Promise<boolean>;
  /** Put spots from an expired hold or a cancelled booking back on the sheet. */
  releaseSpots(tx: Tx, teeTimeId: string, players: number): Promise<void>;
  /** Record the booking on the course's sheet. Returns the course system's reference, if any. */
  confirmBooking(tx: Tx, booking: { teeTimeId: string; players: number; golferName: string }): Promise<string | null>;
  /** Cancel the booking on the course's sheet and free its spots. */
  cancelBooking(tx: Tx, booking: { teeTimeId: string; players: number; teeSheetRef: string | null }): Promise<void>;
}

/** Courses that book directly with us: our tables are the tee sheet. */
export const localTeeSheet: TeeSheetProvider = {
  async syncAvailability() {},

  async reserveSpots(tx, teeTimeId, players) {
    // Conditional decrement, so two golfers can never take the same spots.
    const { count } = await tx.teeTime.updateMany({
      where: { id: teeTimeId, spotsLeft: { gte: players } },
      data: { spotsLeft: { decrement: players } },
    });
    return count === 1;
  },

  async releaseSpots(tx, teeTimeId, players) {
    await tx.teeTime.update({ where: { id: teeTimeId }, data: { spotsLeft: { increment: players } } });
  },

  async confirmBooking() {
    return null;
  },

  async cancelBooking(tx, booking) {
    await localTeeSheet.releaseSpots(tx, booking.teeTimeId, booking.players);
  },
};

const providers: Record<string, TeeSheetProvider> = { local: localTeeSheet };

export function teeSheetFor(course: { teeSheet: string }): TeeSheetProvider {
  const provider = providers[course.teeSheet];
  if (!provider) throw new Error(`No tee sheet provider registered for "${course.teeSheet}"`);
  return provider;
}
