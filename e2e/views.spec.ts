import { expect, test } from "@playwright/test";
import { DEMO_USERS, FIXTURES } from "../src/lib/demo-accounts";
import { login } from "./helpers";

test("switching a saved view restores filters, sort, and the list", async ({ page }) => {
  await login(page);
  await page.getByTestId("filter-status").click();
  await page.getByRole("option", { name: "Todo" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("filter-priority").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/priority=high/);
  await page.getByTestId("sort").selectOption("newest");
  await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/ORB\/list/);
  await expect(page).toHaveURL(/sort=newest/);

  await page.getByTestId("saved-views").click();
  await page.getByLabel("View name").fill("Triage list");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("link", { name: "Triage list" })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByTestId("saved-views").click();
  await page.getByRole("link", { name: "Triage list" }).click();
  await expect(page).toHaveURL(/\/p\/ORB\/list/);
  await expect(page).toHaveURL(/status=todo/);
  await expect(page).toHaveURL(/priority=high/);
  await expect(page).toHaveURL(/sort=newest/);
  await expect(page.getByTestId("sort")).toHaveValue("newest");
  await expect(page.getByText(FIXTURES.zephyrTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/status=todo/);
  await expect(page).toHaveURL(/sort=newest/);
  await expect(page.getByText(FIXTURES.zephyrTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toHaveCount(0);
  await page.getByTestId("saved-views").click();
  await expect(page.getByRole("link", { name: "Triage list" })).toBeVisible();
});

test("keeps saved views private to the user who created them", async ({ page }) => {
  await login(page);
  await page.getByTestId("saved-views").click();
  await page.getByLabel("View name").fill("Ava private");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("link", { name: "Ava private" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await login(page, DEMO_USERS[1].email);
  await page.getByTestId("saved-views").click();
  await expect(page.getByRole("link", { name: "Ava private" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Triage list" })).toHaveCount(0);
  await page.getByLabel("View name").fill("Marcus private");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("link", { name: "Marcus private" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await login(page);
  await page.getByTestId("saved-views").click();
  await expect(page.getByRole("link", { name: "Ava private" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Marcus private" })).toHaveCount(0);
});

test("renames a view, opens it as the default after sign-in, and can delete it", async ({ page }) => {
  await login(page);
  await page.getByTestId("filter-status").click();
  await page.getByRole("option", { name: "Todo" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("saved-views").click();
  await page.getByLabel("View name").fill("Release watch");
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByRole("button", { name: "Rename Release watch" }).click();
  await page.getByRole("textbox", { name: "New name for Release watch" }).fill("Release board");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("link", { name: "Release board" })).toBeVisible();

  await page.getByRole("button", { name: "Set default Release board" }).click();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await login(page);
  await expect(page).toHaveURL(/status=todo/);
  await expect(page.getByText(FIXTURES.zephyrTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toHaveCount(0);

  await page.getByTestId("saved-views").click();
  await page.getByRole("button", { name: "Delete Release board" }).click();
  await expect(page.getByRole("link", { name: "Release board" })).toHaveCount(0);
  await page.goto("/p/ORB");
  await expect(page).toHaveURL(/\/p\/ORB$/);
  await expect(page.getByText(FIXTURES.hiddenTitle)).toBeVisible();
});
