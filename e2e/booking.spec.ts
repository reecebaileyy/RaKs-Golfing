import { expect, test } from "@playwright/test";
import { bookMatch, holdTomorrow, signIn } from "./match-helpers";

// Walks the whole flow on a phone-sized screen: search, hold, sign in, set up the match, pay, cancel.
test("book a tee time with a match and cancel it", async ({ page }) => {
  await holdTomorrow(page, 2);

  // Every booking is a match, so checkout asks you to sign in and brings you back.
  await expect(page).toHaveURL(/\/signin\?next=%2Fcheckout%2F/);
  await signIn(page, "jordan@example.com");
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByRole("timer")).toContainText("holding this time");

  // Formats that need a different number of golfers can't be picked.
  await expect(page.getByRole("radio", { name: "2v2 best ball match play" })).toBeDisabled();
  await page.getByLabel("Wager").fill("15");
  await page.getByRole("button", { name: /Next: review and pay/ }).click();
  await expect(page.getByText("The minimum wager is $20.00.")).toBeVisible();

  await bookMatch(page, { format: "1v1 match play" });
  const code = await page.getByTestId("confirmation-code").textContent();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  await expect(page.getByText("Your match")).toBeVisible();
  await expect(page.getByTestId("invite-link")).toContainText("/matches/");

  await page.goto("/reservations");
  await expect(page.getByText(/2 golfers/).first()).toBeVisible();

  await page.goto(`/reservations/${code}`);
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await expect(page.getByText(/every player's wager is refunded/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText("Cancelled: refunded")).toBeVisible();
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
  await expect(golferA).toHaveURL(/\/(checkout|signin)/);

  await golferB.getByRole("button", { name: /Continue/ }).click();
  await expect(golferB.getByText("That tee time just filled up.")).toBeVisible();
  await expect(golferB.getByText("Closest open times:")).toBeVisible();
});
