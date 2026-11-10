import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, PRIMARY_DEMO } from "../src/lib/demo-accounts";
import { login } from "./helpers";

test("logs in with demo credentials and logs out", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Orbit" })).toBeVisible();
  await expect(page.getByText("Board drag drops the card in the wrong column")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/p/ORB");
  await expect(page).toHaveURL(/\/login/);
});

test("shows an error for a bad password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});

test("signs up, creates a project, and shows the empty board", async ({ page }) => {
  const email = `new.${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("New Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { name: "Your workspace is empty" })).toBeVisible();
  await page.getByLabel("Project name").fill("Launchpad");
  await expect(page.getByLabel("Key")).toHaveValue("LAU");
  await page.getByLabel("Key").fill("LNP");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/p\/LNP/);
  await expect(page.getByRole("heading", { name: "No issues yet" })).toBeVisible();
});

test("demo hint matches the documented password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(DEMO_PASSWORD)).toBeVisible();
  await page.getByTestId("demo-login").click();
  await expect(page.getByLabel("Email")).toHaveValue(PRIMARY_DEMO.email);
});

test("blocks a run of bad passwords for one email", async ({ page }) => {
  const email = `limited.${Date.now()}@example.com`;
  await page.goto("/login");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Too many attempts. Try again in a few minutes.")).toBeVisible();
});

test("blocks repeated registration of one email", async ({ page }) => {
  const email = `repeat.${Date.now()}@example.com`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.context().clearCookies();
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Repeat Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    if (attempt === 0) await expect(page).toHaveURL(/\/welcome/);
    else await expect(page.getByText("An account with this email already exists")).toBeVisible();
  }
  await page.context().clearCookies();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Repeat Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Too many attempts. Try again in a few minutes.")).toBeVisible();
});
