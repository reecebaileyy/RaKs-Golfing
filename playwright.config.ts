import { defineConfig, devices } from "@playwright/test";

// PW_PORT lets several checkouts run their e2e suites side by side.
const PORT = Number(process.env.PW_PORT ?? 3100);

// Each run gets a brand-new Postgres schema, dropped again in global-teardown.ts. Set once here:
// workers inherit the environment, so they all see the same one.
process.env.E2E_SCHEMA ??= `e2e_${Date.now()}`;
const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/raks_test");
url.searchParams.set("schema", process.env.E2E_SCHEMA);
process.env.E2E_DATABASE_URL = url.toString();

export default defineConfig({
  testDir: "e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone 13"],
    browserName: "chromium",
    // Lets sandboxed environments point at a preinstalled Chromium.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL,
      DATABASE_URL_UNPOOLED: process.env.E2E_DATABASE_URL,
      // Test switches: a stand-in social consent page and sign-in codes shown on screen.
      OAUTH_MOCK: "1",
      LOGIN_CODE_ECHO: "1",
      AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
      SITE_MODE: "",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
