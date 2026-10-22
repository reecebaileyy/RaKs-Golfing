import { expect, test, type Page } from "@playwright/test";

// The e2e server runs with OAUTH_MOCK=1 (a stand-in consent page for X, TikTok and Instagram)
// and LOGIN_CODE_ECHO=1 (sign-in codes are shown on screen), see playwright.config.ts.
// Next.js keeps an empty role="alert" route announcer on every page, so skip it.
const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const phoneFor = (n: string) => `714${n.slice(-7).padStart(7, "2").replace(/^[01]/, "2")}`;

async function joinWithEmail(page: Page, name: string, email: string) {
  await page.goto("/waitlist");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByTestId("waitlist-spot")).toContainText(/on the list/);
}

test("join with email, share the invite link, post a golf take", async ({ page, browser }) => {
  const id = unique();
  await joinWithEmail(page, "Riley Fairway", `riley-${id}@example.com`);
  const invite = await page.getByLabel("Your invite link").inputValue();
  expect(invite).toMatch(/\?ref=[A-Z2-9]{7}$/);

  const take = `Three putted 18 at Brea again ${id}`;
  await page.getByLabel("Your golf take").fill(take);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByTestId("golf-comment").filter({ hasText: take })).toContainText("Riley F.");

  // A friend joins by phone through the invite link, and Riley's count goes up.
  const friend = await (await browser.newContext()).newPage();
  await friend.goto(invite.replace(/^https?:\/\/[^/]+/, ""));
  await friend.getByRole("radio", { name: "Phone" }).check();
  await friend.getByLabel("Your name").fill("Pat Friend");
  await friend.getByLabel("Phone number").fill(phoneFor(id));
  await friend.getByLabel("ZIP code (optional)").fill("92831");
  await friend.getByLabel("How often do you play?").selectOption("5+");
  await friend.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(friend.getByTestId("waitlist-spot")).toContainText(/on the list/);
  await page.reload();
  await expect(page.getByTestId("waitlist-spot")).toContainText(/1 golfer joined with your link/);

  // Signed out, the wall still shows but asks you to join to post.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/waitlist");
  await expect(visitor.getByTestId("golf-comment").filter({ hasText: take })).toBeVisible();
  await expect(visitor.getByText("Join the waitlist to post.")).toBeVisible();
  await expect(visitor.getByLabel("Your golf take")).toHaveCount(0);
});

test("an email that's already on the list can't sign in by joining again", async ({ page, browser }) => {
  const email = `dupe-${unique()}@example.com`;
  await joinWithEmail(page, "First Golfer", email);

  const other = await (await browser.newContext()).newPage();
  await other.goto("/waitlist");
  await other.getByLabel("Your name").fill("Second Golfer");
  await other.getByRole("textbox", { name: "Email", exact: true }).fill(email.toUpperCase());
  await other.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(alertOf(other)).toContainText("already on the list");
  await expect(other.getByTestId("waitlist-spot")).toHaveCount(0);
});

test("social sign-up needs an email or phone, then signs back in with the same login", async ({ page, browser }) => {
  const handle = `tt${unique()}`;
  await page.goto("/waitlist");
  await page.getByRole("link", { name: "Continue with TikTok" }).click();
  // The stand-in TikTok consent page.
  await page.getByLabel("TikTok username").fill(handle);
  await page.getByRole("button", { name: "Authorize RaKs Golfing" }).click();

  await expect(page).toHaveURL(/\/join\/finish/);
  await expect(page.getByRole("heading", { name: new RegExp(handle) })).toBeVisible();
  await page.getByLabel("Your name").fill("Tik Toker");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(alertOf(page)).toContainText("Add an email or a phone number");
  await page.getByLabel("Phone number").fill(phoneFor(handle));
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByTestId("waitlist-spot")).toContainText(/on the list/);
  await expect(page.getByTestId("waitlist-spot")).toContainText(/TikTok/);

  // Later, on another device: TikTok again lands straight on their spot, no questions.
  const again = await (await browser.newContext()).newPage();
  await again.goto("/signin?next=/waitlist");
  await again.getByRole("link", { name: "Continue with TikTok" }).click();
  await again.getByLabel("TikTok username").fill(handle);
  await again.getByRole("button", { name: "Authorize RaKs Golfing" }).click();
  await expect(again).toHaveURL(/\/waitlist/);
  await expect(again.getByTestId("waitlist-spot")).toContainText(/on the list/);
});

test("cancelling a social sign-in comes back with a message", async ({ page }) => {
  await page.goto("/waitlist");
  await page.getByRole("link", { name: "Continue with X" }).click();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/waitlist\?oauth_error=cancelled/);
  await expect(alertOf(page)).toContainText("Sign-in was cancelled.");
});

test("sign in with a one-time code", async ({ page, browser }) => {
  const email = `code-${unique()}@example.com`;
  await joinWithEmail(page, "Codey Golfer", email);

  const device = await (await browser.newContext()).newPage();
  await device.goto("/signin?method=code&next=/waitlist");
  await device.getByLabel("Email or phone number").fill(email);
  await device.getByRole("button", { name: "Send me a code" }).click();
  await expect(device.getByText(/We sent a 6-digit code to c•••@example\.com/)).toBeVisible();
  const code = (await device.locator(".font-mono").first().textContent())!.trim();
  await device.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
  await device.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(alertOf(device)).toContainText("That code didn't work");
  await device.getByLabel("6-digit code").fill(code);
  await device.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(device).toHaveURL(/\/waitlist/);
  await expect(device.getByTestId("waitlist-spot")).toContainText(/on the list/);

  // An address with no account is told to join first.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto("/signin?method=code");
  await stranger.getByLabel("Email or phone number").fill(`nobody-${unique()}@example.com`);
  await stranger.getByRole("button", { name: "Send me a code" }).click();
  await expect(alertOf(stranger)).toContainText("Join the waitlist first");
});

test("the admin dashboard counts sign-ups and hides comments", async ({ page, browser }) => {
  const id = unique();
  const golfer = await (await browser.newContext()).newPage();
  await joinWithEmail(golfer, "Wally Wall", `wall-${id}@example.com`);
  const take = `Hide me please ${id}`;
  await golfer.getByLabel("Your golf take").fill(take);
  await golfer.getByRole("button", { name: "Post", exact: true }).click();
  await expect(golfer.getByTestId("golf-comment").filter({ hasText: take })).toBeVisible();

  await page.goto("/signin?next=/admin/waitlist");
  await page.getByLabel("Email").fill("reece@example.com");
  await page.getByLabel("Password").fill("golf1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Waitlist" })).toBeVisible();
  expect(Number(await page.getByTestId("waitlist-total").textContent())).toBeGreaterThan(0);

  const row = page.getByTestId("admin-comment").filter({ hasText: take });
  await row.getByRole("button", { name: "Hide" }).click();
  await expect(row.getByText("Hidden", { exact: true })).toBeVisible();
  await golfer.reload();
  await expect(golfer.getByTestId("golf-comment").filter({ hasText: take })).toHaveCount(0);

  const csv = await page.request.get("/api/admin/waitlist/export");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(`wall-${id}@example.com`);
  // Golfers can't download it.
  expect((await golfer.request.get("/api/admin/waitlist/export")).status()).toBe(403);
});
