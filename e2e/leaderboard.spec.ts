import { expect, test } from "@playwright/test";

// The leaderboard is public: signed out, see ranked golfers, then sort by earnings.
test("browse the leaderboard signed out and sort by earnings", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Ranking" })).toHaveAttribute("aria-selected", "true");

  const ranked = page.getByRole("list", { name: "Ranked golfers" }).getByTestId("leaderboard-row");
  await expect(ranked.first()).toBeVisible();
  expect(await ranked.count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("heading", { name: "Not ranked yet" })).toBeVisible();

  await page.getByRole("tab", { name: "Earnings" }).click();
  await expect(page).toHaveURL(/sort=earnings/);
  await expect(page.getByRole("tab", { name: "Earnings" })).toHaveAttribute("aria-selected", "true");
  const rows = page.getByRole("list", { name: "Golfers" }).getByTestId("leaderboard-row");
  await expect(rows.first()).toBeVisible();

  // Highest earner first.
  const amounts = (await rows.getByTestId("leaderboard-headline").allTextContents()).map((t) => Number(t.replace(/[^0-9.-]/g, "")));
  expect(amounts).toEqual([...amounts].sort((a, b) => b - a));

  await page.getByText("How rankings work").click();
  await expect(page.getByText(/count 60%/)).toBeVisible();

  const res = await page.request.get("/api/leaderboard?sort=earnings");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.rows.length).toBeGreaterThan(0);
});
