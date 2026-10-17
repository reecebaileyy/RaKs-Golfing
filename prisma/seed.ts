// Demo data: four made-up Orange County courses with tee times for the next 10 days.
import { PrismaClient, type PaymentMode } from "@prisma/client";
import { addDays, todayIn, zonedTime } from "../src/lib/time";

const db = new PrismaClient();
const TZ = "America/Los_Angeles";

const courses = [
  { slug: "fullerton-ridge", name: "Fullerton Ridge Golf Club", city: "Fullerton", address: "1200 Ridge Crest Dr", latitude: 33.89, longitude: -117.92, base: 6500, taxRateBps: 0, taxIncluded: true, cancelWindowHours: 24 },
  { slug: "brea-canyon-links", name: "Brea Canyon Links", city: "Brea", address: "400 Canyon Country Rd", latitude: 33.93, longitude: -117.88, base: 5200, taxRateBps: 775, taxIncluded: false, cancelWindowHours: 24 },
  { slug: "santa-ana-river", name: "Santa Ana River Course", city: "Anaheim", address: "2800 River Trail Way", latitude: 33.84, longitude: -117.86, base: 4200, taxRateBps: 775, taxIncluded: false, cancelWindowHours: 48 },
  { slug: "laguna-bluffs", name: "Laguna Bluffs Golf Club", city: "Laguna Niguel", address: "9 Ocean Bluff Rd", latitude: 33.52, longitude: -117.71, base: 11500, taxRateBps: 0, taxIncluded: true, cancelWindowHours: 24 },
];

// Deterministic pseudo-random so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

async function main() {
  await db.reservation.deleteMany();
  await db.hold.deleteMany();
  await db.rate.deleteMany();
  await db.teeTime.deleteMany();
  await db.golfer.deleteMany();
  await db.course.deleteMany();

  const today = todayIn(TZ);
  for (const c of courses) {
    const course = await db.course.create({
      data: {
        slug: c.slug, name: c.name, city: c.city, state: "CA", address: c.address,
        latitude: c.latitude, longitude: c.longitude, timezone: TZ,
        convenienceFeeCents: 299, taxRateBps: c.taxRateBps, taxIncluded: c.taxIncluded,
        cancelWindowHours: c.cancelWindowHours,
        policyNotes: `Cancel at least ${c.cancelWindowHours} hours before your tee time for a refund. Proper golf attire required. Rain checks are issued by the pro shop.`,
      },
    });

    for (let d = 0; d < 10; d++) {
      const ymd = addDays(today, d);
      const weekend = [0, 6].includes(new Date(`${ymd}T12:00:00Z`).getUTCDay());
      for (let minutes = 6 * 60 + 30; minutes <= 17 * 60; minutes += 10) {
        if (rand() < 0.35) continue; // already booked elsewhere
        const hour = Math.floor(minutes / 60);
        const startsAt = zonedTime(ymd, hour, minutes % 60, TZ);
        const twilight = hour >= 15;
        const prime = hour >= 7 && hour < 11;
        const rack = Math.round((c.base * (weekend ? 1.25 : 1) * (twilight ? 0.65 : 1)) / 100) * 100;

        const rates: { name: string; holes: number; cartIncluded: boolean; greenFeeCents: number; rackRateCents?: number; isHotDeal: boolean; paymentMode: PaymentMode }[] = [
          { name: twilight ? "Twilight 18 w/ Cart" : "18 Holes w/ Cart", holes: 18, cartIncluded: true, greenFeeCents: rack, isHotDeal: false, paymentMode: "PAY_AT_COURSE" },
        ];
        if (!prime) rates.push({ name: "9 Holes Walking", holes: 9, cartIncluded: false, greenFeeCents: Math.round(rack * 0.45 / 100) * 100, isHotDeal: false, paymentMode: "PAY_AT_COURSE" });
        if (!prime && rand() < 0.4) {
          const off = 0.2 + rand() * 0.25;
          rates.push({ name: "Hot Deal 18 w/ Cart", holes: 18, cartIncluded: true, greenFeeCents: Math.round(rack * (1 - off) / 100) * 100, rackRateCents: rack, isHotDeal: true, paymentMode: "PREPAID" });
        }

        await db.teeTime.create({
          data: {
            courseId: course.id,
            startsAt,
            spotsLeft: rand() < 0.25 ? 2 : 4,
            minPlayers: weekend && prime ? 2 : 1,
            rates: { create: rates },
          },
        });
      }
    }
  }
  console.log(`Seeded ${courses.length} courses from ${today}.`);
}

main().finally(() => db.$disconnect());
