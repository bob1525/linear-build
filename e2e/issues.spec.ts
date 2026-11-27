import { expect, test } from "@playwright/test";
import { FIXTURES } from "../src/lib/demo-accounts";
import { dragCard, login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("changes status from the issue page and records activity", async ({ page }) => {
  await page.getByRole("link", { name: FIXTURES.statusTitle }).click();
  await expect(page.getByLabel("Title")).toHaveValue(FIXTURES.statusTitle);
  await page.getByTestId("status-select").click();
  await page.getByRole("option", { name: "In Progress" }).click();
  await expect(page.getByText("changed status from Todo to In Progress")).toBeVisible();
});

test("posts a markdown comment", async ({ page }) => {
  await page.getByRole("link", { name: FIXTURES.commentTitle }).click();
  const note = `Looks contained in the latest build ${Date.now()}`;
  await page.getByLabel("Comment").fill(`**Update**\n\n${note}`);
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByTestId("comments").getByText(note)).toBeVisible();
  await expect(page.getByText("Ava Chen commented").first()).toBeVisible();
});

test("changes status from the list", async ({ page }) => {
  await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
  const row = page.locator("[data-testid^='row-']", { hasText: FIXTURES.listStatusTitle });
  await row.getByRole("button", { name: /Change status/ }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(row.getByText("Done", { exact: true })).toBeVisible();
});

test("creates an issue from the dialog", async ({ page }) => {
  const title = `Playwright issue ${Date.now()}`;
  await page.getByRole("button", { name: "New issue" }).click();
  await expect(page.getByRole("dialog", { name: "New issue" })).toBeVisible();
  await page.getByPlaceholder("Issue title").fill(title);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();
  await expect(page.getByText(title)).toBeVisible();
});

test("drags a card into another column", async ({ page }) => {
  await dragCard(page, FIXTURES.dragTitle, "todo");
  const moved = page.getByTestId("column-todo").getByRole("link", { name: FIXTURES.dragTitle });
  await expect(moved).toBeVisible();
  await expect(page.locator("article", { hasText: FIXTURES.dragTitle })).toHaveCount(1);
  await moved.click();
  await expect(page.getByText("changed status from Backlog to Todo")).toBeVisible();
});

test("opens the new issue dialog from the keyboard", async ({ page }) => {
  await page.keyboard.press("c");
  await expect(page.getByRole("dialog", { name: "New issue" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();
  await page.keyboard.press("/");
  await expect(page.getByTestId("search")).toBeFocused();
});
