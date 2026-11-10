import { expect, test } from "@playwright/test";
import { FIXTURES } from "../src/lib/demo-accounts";
import { RELATION_ERRORS } from "../src/lib/relations";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("shows blocking relations on the issue, the board, and the list", async ({ page }) => {
  const blocked = page.getByTestId("card-ORB-2");
  const blocker = page.getByTestId("card-ORB-3");
  await expect(blocked).toHaveAttribute("data-blocked", "true");
  await expect(blocked.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(blocker).toHaveAttribute("data-blocks", "true");
  await expect(blocker.getByText("Blocks", { exact: true })).toBeVisible();

  await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
  await expect(page.getByTestId("row-ORB-2")).toHaveAttribute("data-blocked", "true");
  await expect(page.getByTestId("row-ORB-2").getByText("Blocked", { exact: true })).toBeVisible();
  await expect(page.getByTestId("row-ORB-3").getByText("Blocks", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: FIXTURES.statusTitle }).click();
  await expect(page.getByTestId("relations-blocked-by")).toContainText("ORB-3");
  await expect(page.getByTestId("relations-blocked-by")).toContainText(FIXTURES.zephyrTitle);
  await expect(page.getByTestId("relations-blocks")).toContainText("None");
});

test("adds a related issue, keeps it after reload, and rejects a duplicate", async ({ page }) => {
  await page.goto("/p/ORB/issues/4");
  await expect(page.getByTestId("relations-related")).toContainText("ORB-5");
  await page.getByLabel("Relation type").selectOption("related");
  await page.getByLabel("Issue key").fill("ORB-6");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relations-related")).toContainText(FIXTURES.hiddenTitle);
  await expect(page.getByText("related this issue to ORB-6")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("relations-related")).toContainText("ORB-6");
  await expect(page.getByTestId("relations-related")).toContainText("ORB-5");

  await page.getByLabel("Relation type").selectOption("related");
  await page.getByLabel("Issue key").fill("ORB-6");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relation-error")).toContainText(RELATION_ERRORS.duplicate);
});

test("rejects a blocking cycle from the issue page", async ({ page }) => {
  await page.goto("/p/ORB/issues/7");
  await page.getByLabel("Relation type").selectOption("blocks");
  await page.getByLabel("Issue key").fill("ORB-8");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relations-blocks")).toContainText("ORB-8");

  await page.goto("/p/ORB/issues/8");
  await expect(page.getByTestId("relations-blocked-by")).toContainText("ORB-7");
  await page.getByLabel("Relation type").selectOption("blocks");
  await page.getByLabel("Issue key").fill("ORB-7");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relation-error")).toContainText(RELATION_ERRORS.cycle);
  await expect(page.getByTestId("relations-blocks")).toContainText("None");
});

test("removes a blocked-by relation and clears the board marker", async ({ page }) => {
  await page.goto("/p/ORB/issues/2");
  await page.getByRole("button", { name: "Remove blocked by ORB-3" }).click();
  await expect(page.getByTestId("relations-blocked-by")).toContainText("None");
  await expect(page.getByText("is no longer blocked by ORB-3")).toBeVisible();
  await page.goto("/p/ORB");
  await expect(page.getByTestId("card-ORB-2")).toHaveAttribute("data-blocked", "false");
  await expect(page.getByTestId("card-ORB-2").getByText("Blocked", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("card-ORB-3")).toHaveAttribute("data-blocks", "false");
});

test("shows, adds, and removes one level of sub-issues", async ({ page }) => {
  await page.goto("/p/ORB/issues/5");
  await expect(page.getByTestId("relations-parent")).toContainText("ORB-1");
  await expect(page.getByTestId("relations-parent")).toContainText("Board drag drops the card in the wrong column");

  await page.goto("/p/ORB/issues/1");
  await expect(page.getByTestId("relations-subissues")).toContainText("ORB-5");
  await page.getByLabel("Relation type").selectOption("sub_issue");
  await page.getByLabel("Issue key").fill("ORB-6");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relations-subissues")).toContainText(FIXTURES.hiddenTitle);
  await expect(page.getByText("added ORB-6 as a sub-issue")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("relations-subissues")).toContainText(FIXTURES.hiddenTitle);
  await expect(page.getByText("added ORB-6 as a sub-issue")).toBeVisible();

  await page.goto("/p/ORB/issues/6");
  await expect(page.getByTestId("relations-parent")).toContainText("ORB-1");
  await page.getByLabel("Relation type").selectOption("sub_issue");
  await page.getByLabel("Issue key").fill("ORB-9");
  await page.getByRole("button", { name: "Add relation" }).click();
  await expect(page.getByTestId("relation-error")).toContainText(RELATION_ERRORS.subLevel);

  await page.goto("/p/ORB/issues/1");
  await page.getByRole("button", { name: "Remove sub-issue ORB-6" }).click();
  await expect(page.getByTestId("relations-subissues").getByText("ORB-6")).toHaveCount(0);
  await expect(page.getByTestId("relations-subissues")).toContainText("ORB-5");
});
