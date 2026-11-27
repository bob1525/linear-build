import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Password Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/welcome/);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a signed-in user replaces their password and other sessions end", async ({ page, browser }) => {
  const email = `pw.${Date.now()}@example.com`;
  const current = "password123";
  const next = "password456";
  await signUp(page, email, current);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  try {
    await signIn(otherPage, email, current);
    await expect(otherPage).toHaveURL(/\/welcome/);

    await page.getByRole("link", { name: "Change password" }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
    await page.getByLabel("Current password").fill("not-the-password");
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();

    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill("password789");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();

    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("password-updated")).toBeVisible();

    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login/);
  } finally {
    await other.close();
  }

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, email, current);
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await signIn(page, email, next);
  await expect(page).toHaveURL(/\/welcome/);
});

test("blocks a run of wrong current passwords for one account", async ({ page }) => {
  const email = `pwlimit.${Date.now()}@example.com`;
  const current = "password123";
  await signUp(page, email, current);
  await page.getByRole("link", { name: "Change password" }).click();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByLabel("Current password").fill(`wrong-${attempt}`);
    await page.getByLabel("New password", { exact: true }).fill("password456");
    await page.getByLabel("Confirm new password").fill("password456");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();
  }
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill("password456");
  await page.getByLabel("Confirm new password").fill("password456");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Too many attempts. Try again in a few minutes.")).toBeVisible();
  await expect(page.getByTestId("password-updated")).toHaveCount(0);
});

test("the account link opens the password form", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  await expect(page.getByLabel("Current password")).toBeVisible();
  await expect(page.getByTestId("mail-status")).toHaveText(
    "Email delivery is not configured, so features that send mail stay off.",
  );
});

test("a logged-out visit to the password page goes to sign in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});
