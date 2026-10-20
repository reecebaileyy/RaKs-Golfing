// Gives a test file a brand-new Postgres schema, so test files can run side by side and never
// touch real data. The file drops its schema when it finishes.
// Point TEST_DATABASE_URL at any Postgres you can write to; the default is a local one.
import { execSync } from "node:child_process";

export function useTestSchema(name: string): string {
  const schema = `test_${name}_${process.pid}_${Date.now()}`;
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/raks_test");
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.toString();
  process.env.DATABASE_URL_UNPOOLED = url.toString();
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "ignore" });
  return schema;
}
