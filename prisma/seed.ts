// Demo data: four made-up Orange County courses with tee times for the next 10 days.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type PaymentMode } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
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

// Pars and stroke indexes for a typical par 72, reused by every demo course.
const PARS = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
const STROKE_INDEX = [7, 3, 15, 1, 11, 9, 17, 5, 13, 8, 2, 16, 4, 12, 6, 18, 10, 14];
const YARDS = { 3: 165, 4: 390, 5: 530 } as Record<number, number>;

export const DEMO_PASSWORD = "golf1234";
export const DEMO_USERS = [
  { email: "reece@example.com", name: "Reece Bailey", ghin: "1234567", ghinIndex: 8.4, verified: true, admin: true, skill: 9 },
  { email: "maya@example.com", name: "Maya Torres", ghin: "2345678", ghinIndex: 12.1, verified: true, admin: false, skill: 12 },
  { email: "jordan@example.com", name: "Jordan Lee", ghin: null, ghinIndex: null, verified: false, admin: false, skill: 16 },
  { email: "sam@example.com", name: "Sam Patel", ghin: "3456789", ghinIndex: 4.2, verified: false, admin: false, skill: 4 },
  { email: "alex@example.com", name: "Alex Kim", ghin: null, ghinIndex: null, verified: false, admin: false, skill: 20 },
];

/** Lays 18 holes out in a loop around the clubhouse so location tracking has real coordinates to match. */
function holeLayout(lat: number, lng: number) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  let x = 0;
  let y = 0;
  return PARS.map((par, i) => {
    const heading = (i / 18) * 2 * Math.PI;
    const length = YARDS[par] * 0.9144;
    const tee = { x, y };
    x += Math.cos(heading) * length;
    y += Math.sin(heading) * length;
    const green = { x, y };
    // Step to the next tee.
    x += Math.cos(heading + Math.PI / 2) * 40;
    y += Math.sin(heading + Math.PI / 2) * 40;
    return {
      number: i + 1,
      par,
      strokeIndex: STROKE_INDEX[i],
      yards: YARDS[par],
      teeLat: lat + tee.y / mPerDegLat,
      teeLng: lng + tee.x / mPerDegLng,
      greenLat: lat + green.y / mPerDegLat,
      greenLng: lng + green.x / mPerDegLng,
    };
  });
}

async function main() {
  // Feature data first (it points at bookings and users), then the booking baseline.
  await db.weatherSnapshot.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.press.deleteMany();
  await db.holeScore.deleteMany();
  await db.matchPlayer.deleteMany();
  await db.match.deleteMany();
  await db.scoreCard.deleteMany();
  await db.session.deleteMany();
  await db.reservation.deleteMany();
  await db.hold.deleteMany();
  await db.rate.deleteMany();
  await db.teeTime.deleteMany();
  await db.golfer.deleteMany();
  await db.user.deleteMany();
  await db.hole.deleteMany();
  await db.teeSet.deleteMany();
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
        holes: { create: holeLayout(c.latitude, c.longitude) },
        teeSets: {
          create: [
            { name: "Blue", courseRating: 72.1 + (c.base > 10000 ? 1.5 : 0), slope: 128 + (c.base > 10000 ? 8 : 0), par: 72, yards: 6600 },
            { name: "White", courseRating: 69.8, slope: 121, par: 72, yards: 6150 },
          ],
        },
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

        const rates: { name: string; holes: number; cartIncluded: boolean; greenFeeCents: number; rackRateCents?: number; isHotDeal: boolean; paymentMode: PaymentMode; maxPlayers?: number; convenienceFeeCents?: number }[] = [
          { name: twilight ? "Twilight 18 w/ Cart" : "18 Holes w/ Cart", holes: 18, cartIncluded: true, greenFeeCents: rack, isHotDeal: false, paymentMode: "PAY_AT_COURSE" },
        ];
        if (!prime) rates.push({ name: "9 Holes Walking", holes: 9, cartIncluded: false, greenFeeCents: Math.round(rack * 0.45 / 100) * 100, isHotDeal: false, paymentMode: "PAY_AT_COURSE" });
        if (!prime && rand() < 0.4) {
          const off = 0.2 + rand() * 0.25;
          // GolfNow's Hot Deals carried a higher booking fee and were often limited to 1-2 golfers.
          rates.push({ name: "Hot Deal 18 w/ Cart", holes: 18, cartIncluded: true, greenFeeCents: Math.round(rack * (1 - off) / 100) * 100, rackRateCents: rack, isHotDeal: true, paymentMode: "PREPAID", maxPlayers: rand() < 0.5 ? 2 : 4, convenienceFeeCents: 349 });
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
  await seedGolfers(today);
  console.log(`Seeded ${courses.length} courses from ${today}.`);

  // Feature modules (prisma/seed/*.ts) each export `seed(db)`, run in name order.
  const dir = join(__dirname, "seed");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    const mod = await import(join(dir, file));
    await mod.seed(db);
    console.log(`Seeded ${file}.`);
  }
}

/** Demo golfers with five recent rounds each, so profiles, handicaps and matches work out of the box. */
async function seedGolfers(today: string) {
  const allCourses = await db.course.findMany({ include: { teeSets: true, holes: { orderBy: { number: "asc" } } } });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    const user = await db.user.create({
      data: {
        email: u.email, name: u.name, passwordHash, isAdmin: u.admin, state: "CA",
        ghinNumber: u.ghin, ghinIndex: u.ghinIndex, ghinVerifiedAt: u.verified ? new Date() : null,
      },
    });
    const diffs: number[] = [];
    for (let r = 0; r < 5; r++) {
      const course = allCourses[(r + u.skill) % allCourses.length];
      const tee = course.teeSets.find((t) => t.name === "White")!;
      // Spread strokes over the holes: harder holes (low stroke index) get the extra strokes first.
      const over = Math.max(0, Math.round(u.skill * (tee.slope / 113) + (rand() - 0.4) * 6));
      const strokes = course.holes.map((h) => h.par + Math.floor(over / 18) + (h.strokeIndex <= over % 18 ? 1 : 0));
      const gross = strokes.reduce((a, b) => a + b, 0);
      const adjusted = course.holes.reduce((sum, h, i) => sum + Math.min(strokes[i], h.par + 5), 0);
      const differential = Math.round(((113 / tee.slope) * (adjusted - tee.courseRating)) * 10) / 10;
      diffs.push(differential);
      await db.scoreCard.create({
        data: {
          userId: user.id, courseId: course.id, teeSetId: tee.id,
          playedAt: zonedTime(addDays(today, -7 * (r + 1)), 9, 0, TZ),
          holeStrokes: JSON.stringify(strokes), grossScore: gross, adjustedGross: adjusted, differential,
        },
      });
    }
    // WHS with 5 scores: the lowest differential. Verified GHIN golfers play off their GHIN index.
    const appIndex = Math.min(...diffs);
    await db.user.update({
      where: { id: user.id },
      data: u.verified
        ? { handicapIndex: u.ghinIndex, handicapSource: "GHIN", verified: true }
        : { handicapIndex: appIndex, handicapSource: "APP" },
    });
  }
}

main().finally(() => db.$disconnect());
