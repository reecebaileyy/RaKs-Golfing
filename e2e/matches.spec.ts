import { devices, expect, test } from "@playwright/test";
import { bookMatch, holdTomorrow, signIn } from "./match-helpers";

// Reece books with an open challenge; Maya, on her own phone, finds it on Matches and joins.
test("an open challenge fills up and goes READY", async ({ browser }) => {
  const reece = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await reece.goto("/signin");
  await signIn(reece, "reece@example.com");
  await expect(reece).toHaveURL("/");
  await holdTomorrow(reece, 2, 6);
  await bookMatch(reece, { format: "1v1 stroke play", openChallenge: true });
  await reece.getByRole("link", { name: "Open match lobby" }).click();
  await expect(reece.getByTestId("match-status")).toHaveText("Waiting for players");
  const code = (await reece.getByTestId("match-code").textContent())!;

  const maya = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await maya.goto("/signin?next=/matches");
  await signIn(maya, "maya@example.com");
  await expect(maya.getByRole("heading", { name: "Matches" })).toBeVisible();
  await maya.locator(`a[href="/matches/${code}"]`).click();

  await expect(maya.getByTestId("due-now")).toContainText("wager $20.00");
  await maya.getByRole("checkbox", { name: /accept the match terms/ }).check();
  await maya.getByRole("button", { name: /Join and pay/ }).click();
  await expect(maya.getByTestId("match-status")).toHaveText("Ready");
  await expect(maya.getByRole("link", { name: "Go to game" })).toHaveAttribute("href", `/play/${code}`);
  await expect(maya.getByTestId("match-player")).toHaveCount(2);

  // Reece sees the same, and Maya's wallet shows the money held.
  await reece.reload();
  await expect(reece.getByTestId("match-status")).toHaveText("Ready");
  await maya.goto("/wallet");
  await expect(maya.getByText("Demo money: no real cards are charged")).toBeVisible();
  await expect(maya.getByTestId("wallet-held")).not.toHaveText("$0.00");
});
