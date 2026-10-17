import { defineConfig, devices } from "@playwright/test";

// PW_PORT lets several checkouts run their e2e suites side by side.
const PORT = Number(process.env.PW_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
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
    env: { DATABASE_URL: "file:./e2e.db" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
