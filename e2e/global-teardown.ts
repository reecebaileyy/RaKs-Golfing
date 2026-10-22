// Drops this run's e2e schema (made fresh in playwright.config.ts).
import { PrismaClient } from "@prisma/client";

export default async function globalTeardown() {
  const schema = process.env.E2E_SCHEMA;
  if (!schema || !/^e2e_\d+$/.test(schema)) return;
  const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
}
