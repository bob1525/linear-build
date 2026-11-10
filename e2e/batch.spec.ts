import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURES } from "../src/lib/demo-accounts";
import { login } from "./helpers";

function e2eDb() {
  return new PrismaClient({
    datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "e2e.db")}` } },
  });
}

async function cleanup(token: string) {
  const client = e2eDb();
  try {
    await client.issue.deleteMany({ where: { title: { startsWith: token } } });
    await client.savedView.deleteMany({ where: { name: { contains: token } } });
  } finally {
    await client.$disconnect();
  }
}

async function createIssue(page: Page, title: string) {
  await page.getByRole("button", { name: "New issue" }).click();
  await page.getByPlaceholder("Issue title").fill(title);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
}

async function filterToken(page: Page, token: string) {
  await page.getByTestId("search").fill(token);
  await expect(page).toHaveURL(new RegExp(`q=${token}`));
}

test("shift and ctrl click select issues, then a batch status change updates only those", async ({ page }) => {
  const token = `Batch${Date.now()}`;
  const titles = [`${token} A`, `${token} B`, `${token} C`];
  try {
    await login(page);
    for (const title of titles) await createIssue(page, title);
    await filterToken(page, token);
    await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
    await expect(page).toHaveURL(/\/p\/ORB\/list/);
    const boxes = page.getByRole("checkbox", { name: /^Select ORB-/ });
    await expect(boxes).toHaveCount(3);
    await boxes.nth(0).click();
    await boxes.nth(2).click({ modifiers: ["Shift"] });
    await expect(boxes.nth(1)).toBeChecked();
    await expect(page.getByTestId("selection-count")).toHaveText("3 selected");
    await boxes.nth(1).click({ modifiers: ["Control"] });
    await expect(boxes.nth(1)).not.toBeChecked();
    await expect(page.getByTestId("selection-count")).toHaveText("2 selected");
    await page.getByTestId("batch-status").click();
    await page.getByTestId("batch-status-in_progress").click();
    await expect(page.getByTestId("batch-result")).toContainText("2 succeeded, 0 failed");
    await expect(page.locator("[data-testid^='row-']").filter({ hasText: titles[0]! })).toContainText("In Progress");
    await expect(page.locator("[data-testid^='row-']").filter({ hasText: titles[2]! })).toContainText("In Progress");
    await expect(page.locator("[data-testid^='row-']").filter({ hasText: titles[1]! })).toContainText("Todo");
  } finally {
    await cleanup(token);
  }
});

test("shows which issue failed when part of a batch no longer exists", async ({ page }) => {
  const token = `Batch${Date.now()}`;
  const keep = `${token} keep`;
  const drop = `${token} drop`;
  try {
    await login(page);
    await createIssue(page, keep);
    await createIssue(page, drop);
    await filterToken(page, token);
    await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: /^Select ORB-/ })).toHaveCount(2);
    await page.getByTestId("select-all").click();
    await expect(page.getByTestId("selection-count")).toHaveText("2 selected");
    const client = e2eDb();
    try {
      await client.issue.deleteMany({ where: { title: drop } });
    } finally {
      await client.$disconnect();
    }
    await page.getByTestId("batch-status").click();
    await page.getByTestId("batch-status-done").click();
    await expect(page.getByTestId("batch-result")).toContainText("1 succeeded, 1 failed");
    await expect(page.getByTestId("batch-result")).toContainText("Unknown issue: Issue not found");
    await expect(page.locator("[data-testid^='row-']").filter({ hasText: keep })).toContainText("Done");
    await expect(page.getByText(drop)).toHaveCount(0);
  } finally {
    await cleanup(token);
  }
});

test("a filtered saved view batches only the issues in that view", async ({ page }) => {
  const token = `Batch${Date.now()}`;
  const titles = [`${token} A`, `${token} B`];
  try {
    await login(page);
    for (const title of titles) await createIssue(page, title);
    await filterToken(page, token);
    await page.getByTestId("saved-views").click();
    await page.getByLabel("View name").fill(`Lane ${token}`);
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(page.getByRole("link", { name: `Lane ${token}` })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByTestId("column-todo").getByRole("link", { name: FIXTURES.zephyrTitle })).toBeVisible();

    await page.getByTestId("saved-views").click();
    await page.getByRole("link", { name: `Lane ${token}` }).click();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect(page.getByRole("link", { name: titles[0]! })).toBeVisible();
    await expect(page.getByRole("link", { name: titles[1]! })).toBeVisible();
    await page.getByTestId("select-all").click();
    await expect(page.getByTestId("selection-count")).toHaveText("2 selected");
    await page.getByTestId("batch-status").click();
    await page.getByTestId("batch-status-in_progress").click();
    await expect(page.getByTestId("batch-result")).toContainText("2 succeeded, 0 failed");
    await expect(page.getByTestId("column-in_progress").getByRole("link", { name: titles[0]! })).toBeVisible();
    await expect(page.getByTestId("column-in_progress").getByRole("link", { name: titles[1]! })).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByTestId("column-todo").getByRole("link", { name: FIXTURES.zephyrTitle })).toBeVisible();
    await expect(page.getByTestId("column-in_progress").getByRole("link", { name: titles[0]! })).toBeVisible();

    await page.getByTestId("saved-views").click();
    await page.getByRole("link", { name: `Lane ${token}` }).click();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect(page.getByTestId("column-in_progress").getByRole("link", { name: titles[0]! })).toBeVisible();
    await expect(page.getByTestId("column-todo").getByRole("link", { name: FIXTURES.zephyrTitle })).toHaveCount(0);
  } finally {
    await cleanup(token);
  }
});

test("asks for confirmation before deleting the selection", async ({ page }) => {
  const token = `Batch${Date.now()}`;
  const title = `${token} gone`;
  try {
    await login(page);
    await createIssue(page, title);
    await filterToken(page, token);
    await page.getByTestId("select-all").click();
    await page.getByTestId("batch-delete").click();
    await expect(page.getByRole("dialog", { name: "Delete issues" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Delete issues" })).toBeHidden();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.getByTestId("batch-delete").click();
    await page.getByRole("button", { name: "Delete issues" }).click();
    await expect(page.getByTestId("batch-result")).toContainText("Deleted");
    await expect(page.getByTestId("batch-result")).toContainText("1 succeeded, 0 failed");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  } finally {
    await cleanup(token);
  }
});
