// Shared steps for the booking and match specs.
import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("golf1234");
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** From search to checkout for tomorrow's `nth` time with `players` golfers (specs run in parallel, so each takes its own). */
export async function holdTomorrow(page: Page, players: number, nth = 0) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find a tee time" })).toBeVisible();
  // Tomorrow, so there are always times left in the day.
  await page.getByRole("group", { name: "Date" }).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: `${players} golfers` }).click();
  await expect(page).toHaveURL(new RegExp(`players=${players}`));
  await page.locator('a[href^="/tee-times/"]').nth(nth).click();
  await expect(page.getByRole("radiogroup", { name: "Rate" })).toBeVisible();
  await expect(page.getByRole("radio", { name: `${players} golfers` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /Continue/ }).click();
}

/** Fills the Match step and the pay step, then books. */
export async function bookMatch(page: Page, opts: { format: string; openChallenge?: boolean }) {
  await expect(page.getByRole("heading", { name: "Set up your match" })).toBeVisible();
  await page.getByRole("radio", { name: opts.format }).click();
  await page.getByRole("radio", { name: "Net" }).click();
  await page.getByLabel("Wager").fill("20");
  if (opts.openChallenge) await page.getByRole("radio", { name: "Open challenge" }).click();
  await page.getByRole("button", { name: /Next: review and pay/ }).click();

  await expect(page.getByTestId("due-now")).toContainText("wager $20.00");
  await page.getByRole("checkbox", { name: /agree to the course policies/ }).check();
  await page.getByRole("checkbox", { name: /agree to the match terms/ }).check();
  await page.getByRole("button", { name: /Book tee time/ }).click();
  await expect(page.getByText("You're booked")).toBeVisible();
}
