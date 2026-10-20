import { expect, test } from "@playwright/test";

// Needs the WHS math in src/lib/golf/handicap.ts (saving a score card computes the differential).
test("sign up, add GHIN, enter a round, get verified by an admin", async ({ page, browser }) => {
  const email = `ghin-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Casey Newgolfer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("golf1234");
  await page.getByRole("button", { name: "Create account" }).click();

  // Onboarding, GHIN path.
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: /I have a GHIN number/ }).click();
  await page.getByLabel("GHIN number").fill("7654321");
  await page.getByLabel(/Current Handicap Index/).fill("10.5");
  await page.getByRole("button", { name: "Continue" }).click();

  // Sign up sends people on to wherever they were headed (the home page here).
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Casey Newgolfer" })).toBeVisible();
  await expect(page.getByText("GHIN on file")).toBeVisible();
  await expect(page.getByTestId("handicap-index")).toHaveText("10.5");
  await expect(page.getByText("Not ranked yet")).toBeVisible();
  await expect(page.getByTestId("verified-badge")).toHaveCount(0);

  // Enter a round: bogey golf, 18 holes.
  await page.goto("/scorecards/new");
  for (let n = 1; n <= 18; n++) await page.getByLabel(`Hole ${n}`, { exact: true }).fill("5");
  await expect(page.getByTestId("card-total")).toContainText("90");
  await page.getByRole("button", { name: "Save score card" }).click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole("heading", { name: "Score cards" })).toBeVisible();

  // Reece (admin) checks the GHIN number.
  const admin = await browser.newPage();
  await admin.goto("/signin?next=/admin/verify");
  await admin.getByLabel("Email").fill("reece@example.com");
  await admin.getByLabel("Password").fill("golf1234");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByRole("heading", { name: "Verify GHIN numbers" })).toBeVisible();
  await expect(admin.getByText(/manual check until USGA GHIN access is licensed/)).toBeVisible();
  const row = admin.getByTestId(`verify-${email}`);
  const golferPath = await row.getByRole("link", { name: "Casey Newgolfer" }).getAttribute("href");
  await row.getByRole("button", { name: "Verified on GHIN" }).click();
  await expect(row).toHaveCount(0);

  // The golfer now has the badge, and anyone can see it on the public page.
  await page.goto("/profile");
  await expect(page.getByTestId("verified-badge")).toBeVisible();
  const visitor = await browser.newPage();
  await visitor.goto(golferPath!);
  await expect(visitor.getByRole("heading", { name: "Casey Newgolfer" })).toBeVisible();
  await expect(visitor.getByTestId("verified-badge")).toBeVisible();
});

test("non-admins can't open the verification queue", async ({ page }) => {
  await page.goto("/signin?next=/admin/verify");
  await page.getByLabel("Email").fill("jordan@example.com");
  await page.getByLabel("Password").fill("golf1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Verify GHIN numbers" })).toHaveCount(0);
  await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
});

test("signed-out visitors are sent to sign in from the profile", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile/);
});
