import { devices, expect, test, type Page } from "@playwright/test";
import { bookMatch, holdTomorrow, signIn } from "./match-helpers";

const PARS = [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];

async function wallet(page: Page) {
  const res = await page.request.get("/api/wallet");
  return (await res.json()).balances as { walletCents: number; heldCents: number };
}

// The whole product in one round: book with a wager, an opponent joins, 18 holes are scored,
// the side that's down calls the ALOHA PRESS and loses it, both confirm, and the money moves.
test("book, join, play 18, press, confirm and settle", async ({ browser }) => {
  test.setTimeout(90_000);
  const reece = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await reece.goto("/signin");
  await signIn(reece, "reece@example.com");
  await expect(reece).toHaveURL("/");
  await holdTomorrow(reece, 2, 9);
  await bookMatch(reece, { format: "1v1 match play", openChallenge: true });
  await reece.getByRole("link", { name: "Open match lobby" }).click();
  const code = (await reece.getByTestId("match-code").textContent())!;

  const maya = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await maya.goto(`/signin?next=/matches/${code}`);
  await signIn(maya, "maya@example.com");
  await maya.getByRole("checkbox", { name: /accept the match terms/ }).check();
  await maya.getByRole("button", { name: /Join and pay/ }).click();
  await expect(maya.getByTestId("match-status")).toHaveText("Ready");

  const reeceBefore = await wallet(reece);
  const mayaBefore = await wallet(maya);

  // Maya makes par everywhere, Reece double bogeys: he's closed out after 10 holes.
  const view = await (await reece.request.get(`/api/play/${code}`)).json();
  const ids = Object.fromEntries(view.players.map((p: { name: string; userId: string }) => [p.name.split(" ")[0], p.userId]));
  for (let hole = 1; hole <= 17; hole++) {
    const res = await reece.request.post(`/api/play/${code}/scores`, {
      data: { holeNumber: hole, scores: [{ userId: ids.Reece, strokes: PARS[hole - 1] + 2 }, { userId: ids.Maya, strokes: PARS[hole - 1] }] },
    });
    expect(res.ok()).toBeTruthy();
  }

  // Down and closed out, Reece presses the last hole from the game screen.
  await reece.goto(`/play/${code}`);
  await expect(reece.getByText(/Maya wins/).first()).toBeVisible();
  await reece.getByRole("button", { name: /ALOHA PRESS/ }).click();
  await expect(reece.getByText("Lose: you pay double ($40.00).")).toBeVisible();
  await reece.getByRole("button", { name: "Call it" }).click();
  await expect(reece.getByRole("region", { name: "Confirm ALOHA PRESS" })).toHaveCount(0);
  await expect(reece.getByRole("button", { name: /ALOHA PRESS/ })).toHaveCount(0);
  await expect.poll(async () => (await wallet(reece)).heldCents).toBe(reeceBefore.heldCents + 2000);

  // He loses hole 18 too.
  const last = await reece.request.post(`/api/play/${code}/scores`, {
    data: { holeNumber: 18, scores: [{ userId: ids.Reece, strokes: 7 }, { userId: ids.Maya, strokes: 5 }] },
  });
  expect(last.ok()).toBeTruthy();

  for (const page of [reece, maya]) {
    await page.goto(`/play/${code}`);
    await page.getByRole("button", { name: "Confirm card" }).click();
    await expect(page.getByRole("button", { name: /Confirm card|One moment/ })).toHaveCount(0);
  }
  await maya.reload();
  await expect(maya.getByRole("region", { name: "Final result" })).toBeVisible();

  // Reece pays double: his $20 wager and $20 press go to Maya, who also gets her $20 back.
  const reeceAfter = await wallet(reece);
  const mayaAfter = await wallet(maya);
  expect(reeceAfter.heldCents).toBe(reeceBefore.heldCents - 2000);
  expect(reeceAfter.walletCents).toBe(reeceBefore.walletCents);
  expect(mayaAfter.heldCents).toBe(mayaBefore.heldCents - 2000);
  expect(mayaAfter.walletCents).toBe(mayaBefore.walletCents + 6000);

  // The public scorecard shows the result, and the round lands on Maya's profile.
  const spectator = await (await browser.newContext()).newPage();
  await spectator.goto(`/live/${code}`);
  await expect(spectator.getByText(/Maya wins/).first()).toBeVisible();
  await maya.goto("/profile");
  await expect(maya.getByText(/1v1 match play/).first()).toBeVisible();
});
