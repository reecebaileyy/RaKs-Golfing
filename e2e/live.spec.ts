import { expect, test, type Page } from "@playwright/test";
import { createReadyMatch, disconnect, PASSWORD } from "./fixtures/live";

test.afterAll(disconnect);

async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Wallet" })).toBeVisible();
}

// Enters strokes by tapping the + and - steppers from the default (par).
async function setStrokes(page: Page, name: string, from: number, to: number) {
  const first = name.split(" ")[0];
  const button = page.getByRole("button", { name: `${first} ${to > from ? "plus" : "minus"} one` });
  for (let i = 0; i < Math.abs(to - from); i++) await button.click();
}

test("play a few holes with location, and watch them live from a signed-out browser", async ({ browser }) => {
  const match = await createReadyMatch();

  // The player's phone, standing on the first tee.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: match.firstTee.lat, longitude: match.firstTee.lng },
    permissions: ["geolocation"],
  });
  const page = await phone.newPage();
  await signIn(page, match.players[0].email);

  // Arrival: the banner offers the game screen and /play lists the round.
  await page.goto("/play");
  await expect(page.getByText(match.courseName).first()).toBeVisible();
  await page.getByRole("link", { name: "Start round" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/play/${match.code}`));

  // Auto hole: tee of hole 1 is where we stand.
  const auto = page.getByRole("button", { name: /Auto hole/ });
  if ((await auto.getAttribute("aria-pressed")) !== "true") await auto.click();
  await expect(auto).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("current-hole")).toHaveText("1");

  // Hole 1: Reece makes par, Maya a bogey. Hole 2: Reece birdie-ish 3 (par 5 -> 4), Maya par.
  await setStrokes(page, "Maya Torres", 4, 5);
  await page.getByRole("button", { name: "Save hole 1" }).click();
  await expect(page.getByTestId("current-hole")).toHaveText("2");
  await setStrokes(page, "Reece Bailey", 5, 4);
  await page.getByRole("button", { name: "Save hole 2" }).click();
  await expect(page.getByTestId("current-hole")).toHaveText("3");
  await page.getByRole("button", { name: "Save hole 3" }).click();
  await expect(page.getByTestId("current-hole")).toHaveText("4");

  // Scorecard tab shows what was saved.
  await page.getByRole("tab", { name: "Scorecard" }).click();
  const card = page.getByRole("table", { name: "Scorecard" });
  await expect(card.getByRole("row", { name: /^1SI/ })).toContainText("5");

  // A signed-out spectator sees the same scores with no account.
  const spectator = await browser.newContext();
  const watcher = await spectator.newPage();
  await watcher.goto(`/live/${match.code}`);
  const watched = watcher.getByRole("table", { name: "Scorecard" });
  await expect(watched.getByRole("row", { name: /^2SI/ })).toContainText("4");
  await expect(watched.getByRole("row", { name: /^3SI/ })).toContainText("3");
  await expect(watcher.getByText("reece@example.com")).toHaveCount(0);

  // Hole 4 appears without a reload (event stream, or polling as the fallback).
  await page.getByRole("tab", { name: "Hole" }).click();
  await setStrokes(page, "Reece Bailey", 4, 6);
  await page.getByRole("button", { name: "Save hole 4" }).click();
  await expect(watched.getByRole("row", { name: /^4SI/ })).toContainText("6", { timeout: 15_000 });

  // The public list shows the match as live.
  await watcher.goto("/live");
  await expect(watcher.getByRole("link", { name: /Reece/ }).first()).toBeVisible();

  await phone.close();
  await spectator.close();
});

test("a non-player is sent to the public scorecard", async ({ browser }) => {
  const match = await createReadyMatch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, "alex@example.com");
  await page.goto(`/play/${match.code}`);
  await expect(page).toHaveURL(new RegExp(`/live/${match.code}`));
  await ctx.close();
});
