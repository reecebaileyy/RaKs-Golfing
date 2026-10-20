// Direct database fixtures for the live-scoring e2e. The seeded demo users and courses already exist
// (see prisma/seed.ts); this adds a READY singles match with frozen strokes on top of them.
import { PrismaClient } from "@prisma/client";

// playwright.config.ts sets E2E_DATABASE_URL to this run's schema.
const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });

export const PASSWORD = "golf1234";

export async function createReadyMatch(): Promise<{
  code: string;
  courseName: string;
  firstTee: { lat: number; lng: number };
  players: { id: string; email: string; name: string }[];
}> {
  const [reece, maya] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "reece@example.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "maya@example.com" } }),
  ]);
  const course = await db.course.findUniqueOrThrow({
    where: { slug: "fullerton-ridge" },
    include: { holes: { orderBy: { number: "asc" } }, teeSets: true },
  });
  const teeSet = course.teeSets.find((t) => t.name === "White") ?? course.teeSets[0];
  const teeTime = await db.teeTime.create({ data: { courseId: course.id, startsAt: new Date(Date.now() + 10 * 60_000), spotsLeft: 2 } });
  // Maya gets a stroke on the four hardest holes.
  const mayaStrokes = course.holes.map((h) => (h.strokeIndex <= 4 ? 1 : 0));
  const code = `E2E${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  await db.match.create({
    data: {
      code,
      format: "SINGLES_MATCH",
      scoring: "NET",
      stakeCents: 2000,
      status: "READY",
      createdById: reece.id,
      courseId: course.id,
      teeTimeId: teeTime.id,
      teeSetId: teeSet.id,
      readyAt: new Date(),
      players: {
        create: [
          { userId: reece.id, side: 0, strokesReceived: JSON.stringify(Array(18).fill(0)), handicapIndex: 8.4, heldCents: 2000, acceptedTermsAt: new Date() },
          { userId: maya.id, side: 1, strokesReceived: JSON.stringify(mayaStrokes), handicapIndex: 12.1, heldCents: 2000, acceptedTermsAt: new Date() },
        ],
      },
    },
  });
  const hole1 = course.holes[0];
  return {
    code,
    courseName: course.name,
    firstTee: { lat: hole1.teeLat!, lng: hole1.teeLng! },
    players: [reece, maya].map((u) => ({ id: u.id, email: u.email!, name: u.name })),
  };
}

export async function disconnect() {
  await db.$disconnect();
}
