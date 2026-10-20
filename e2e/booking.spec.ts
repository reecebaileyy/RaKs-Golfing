import { expect, test } from "@playwright/test";

// Walks the whole flow on a phone-sized screen: search, pick a time, hold, check out, cancel.
test("book and cancel a tee time on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find a tee time" })).toBeVisible();

  // Tomorrow, so there are always times left in the day.
  await page.getByRole("group", { name: "Date" }).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "2 golfers" }).click();
  await expect(page).toHaveURL(/players=2/);

  await page.locator('a[href^="/tee-times/"]').first().click();
  await expect(page.getByRole("radiogroup", { name: "Rate" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "2 golfers" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByRole("timer")).toContainText("holding this time");
  await page.getByLabel("Full name").fill("Test Golfer");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("checkbox", { name: /agree to the course policies/ }).check();
  await page.getByRole("button", { name: /Book tee time/ }).click();

  await expect(page.getByText("You're booked")).toBeVisible();
  const code = await page.getByTestId("confirmation-code").textContent();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  await page.getByRole("link", { name: "My tee times" }).click();
  await expect(page.getByText(/2 golfers/)).toBeVisible();

  await page.goto(`/reservations/${code}`);
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
});

test("when someone else takes the spots first, offer the closest open times", async ({ browser }) => {
  const golferA = await browser.newPage();
  const golferB = await browser.newPage();

  await golferA.goto("/");
  await golferA.getByRole("group", { name: "Date" }).getByRole("button").nth(1).click();
  await golferA.getByRole("button", { name: "4 golfers" }).click();
  await expect(golferA).toHaveURL(/players=4/);
  const href = await golferA.locator('a[href^="/tee-times/"]').first().getAttribute("href");

  // Both golfers are looking at the same open foursome.
  await golferA.goto(href!);
  await golferB.goto(href!);

  await golferA.getByRole("button", { name: /Continue/ }).click();
  await expect(golferA).toHaveURL(/\/checkout\//);

  await golferB.getByRole("button", { name: /Continue/ }).click();
  await expect(golferB.getByText("That tee time just filled up.")).toBeVisible();
  await expect(golferB.getByText("Closest open times:")).toBeVisible();
});
