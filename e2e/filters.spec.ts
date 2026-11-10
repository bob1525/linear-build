import { expect, test } from "@playwright/test";
import { FIXTURES } from "../src/lib/demo-accounts";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("combines status, priority, and keyword filters", async ({ page }) => {
  await page.getByTestId("filter-status").click();
  await page.getByRole("option", { name: "Todo" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/status=todo/);
  await page.getByTestId("filter-priority").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/priority=high/);
  await page.getByTestId("search").fill("zephyr");
  await expect(page).toHaveURL(/status=todo/);
  await expect(page).toHaveURL(/priority=high/);
  await expect(page).toHaveURL(/q=zephyr/);
  await expect(page.getByText(FIXTURES.zephyrTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toHaveCount(0);
  await expect(page.getByText(FIXTURES.statusTitle)).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.getByText(FIXTURES.hiddenTitle)).toBeVisible();
});

test("filters by label and by unassigned assignee", async ({ page }) => {
  await page.getByTestId("filter-label").click();
  await page.getByRole("option", { name: "Feature" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(FIXTURES.hiddenTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.zephyrTitle)).toHaveCount(0);

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.getByTestId("filter-assignee").click();
  await page.getByRole("option", { name: "Unassigned" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(FIXTURES.hiddenTitle)).toBeVisible();
  await expect(page.getByText(FIXTURES.zephyrTitle)).toHaveCount(0);
});

test("switches projects and opens the list view", async ({ page }) => {
  await page.getByRole("link", { name: /Pulse/ }).click();
  await expect(page).toHaveURL(/\/p\/PLS/);
  await expect(page.getByText(FIXTURES.pulseTitle)).toBeVisible();
  await page.getByRole("link", { name: "Orbit" }).click();
  await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/ORB\/list/);
  await page.getByRole("link", { name: FIXTURES.zephyrTitle }).click();
  await expect(page).toHaveURL(/\/p\/ORB\/issues\/3/);
  await expect(page.getByLabel("Title")).toHaveValue(FIXTURES.zephyrTitle);
});
