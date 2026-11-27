import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { DRAG_LAB, PRIMARY_DEMO } from "../src/lib/demo-accounts";
import { login } from "./helpers";

const ROW_COUNT = 40;

function e2eDb() {
  return new PrismaClient({
    datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "e2e.db")}` } },
  });
}

async function cleanup(token: string) {
  const client = e2eDb();
  try {
    await client.issue.deleteMany({ where: { title: { startsWith: token } } });
  } finally {
    await client.$disconnect();
  }
}

async function insertRows(token: string) {
  const client = e2eDb();
  try {
    const project = await client.project.findUnique({ where: { key: "ORB" } });
    const user = await client.user.findUnique({ where: { email: PRIMARY_DEMO.email } });
    if (!project || !user) throw new Error("Orbit seed is missing");
    const last = await client.issue.aggregate({ where: { projectId: project.id }, _max: { number: true } });
    const start = (last._max.number ?? 0) + 1;
    await client.issue.createMany({
      data: Array.from({ length: ROW_COUNT }, (_, index) => ({
        projectId: project.id,
        number: start + index,
        title: `${token} ${String(index + 1).padStart(2, "0")}`,
        status: "todo",
        priority: "medium",
        creatorId: user.id,
      })),
    });
  } finally {
    await client.$disconnect();
  }
}

test("arrow keys reach a list row that was outside the window", async ({ page }) => {
  const token = `A11yList${Date.now()}`;
  const first = `${token} 01`;
  const last = `${token} ${String(ROW_COUNT).padStart(2, "0")}`;
  try {
    await cleanup(token);
    await insertRows(token);
    await login(page);
    await page.getByTestId("search").fill(token);
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
    await expect(page).toHaveURL(/\/p\/ORB\/list/);

    const scroller = page.getByTestId("list-scroll");
    await expect(scroller).toHaveAttribute("data-virtualized", "true");
    await expect.poll(async () => scroller.locator("[data-testid^='row-']").count()).toBeLessThan(ROW_COUNT);
    const firstLink = page.getByRole("link", { name: first, exact: true });
    const lastLink = page.getByRole("link", { name: last, exact: true });
    await expect(firstLink).toBeVisible();
    await expect(lastLink).toHaveCount(0);

    await firstLink.focus();
    await page.keyboard.press("End");
    await expect(lastLink).toBeFocused();
    await expect(firstLink).toHaveCount(0);
    await expect.poll(async () => scroller.locator("[data-testid^='row-']").count()).toBeLessThan(ROW_COUNT);
    const lastRow = scroller.locator(`[data-window-index="${ROW_COUNT - 1}"]`);
    await expect(lastRow).toHaveAttribute("aria-setsize", String(ROW_COUNT));
    await expect(lastRow).toHaveAttribute("aria-posinset", String(ROW_COUNT));

    await page.keyboard.press("Home");
    await expect(firstLink).toBeFocused();
    await expect(lastLink).toHaveCount(0);
    await expect.poll(async () => scroller.locator("[data-testid^='row-']").count()).toBeLessThan(ROW_COUNT);
  } finally {
    await cleanup(token);
  }
});

test("arrow keys reach a board card that was outside the window", async ({ page }) => {
  await login(page);
  await page.goto("/p/RLY");
  const scroller = page.getByTestId("column-scroll-backlog");
  await expect(scroller).toHaveAttribute("data-virtualized", "true");
  const first = page.getByRole("link", { name: DRAG_LAB.backlog(1), exact: true });
  const last = page.getByRole("link", { name: DRAG_LAB.backlog(12), exact: true });
  const todo = page.getByRole("link", { name: DRAG_LAB.short, exact: true });
  await expect(first).toBeVisible();
  await expect(last).toHaveCount(0);
  await expect.poll(async () => scroller.locator("article").count()).toBeLessThan(DRAG_LAB.backlogCount);

  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(todo).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(first).toBeFocused();
  await page.keyboard.press("End");
  await expect(last).toBeFocused();
  await expect(first).toHaveCount(0);
  await expect.poll(async () => scroller.locator("article").count()).toBeLessThan(DRAG_LAB.backlogCount);
  await expect(scroller.locator(`[data-window-index="${DRAG_LAB.backlogCount - 1}"]`)).toHaveAttribute("aria-setsize", String(DRAG_LAB.backlogCount));
  await expect(scroller.locator(`[data-window-index="${DRAG_LAB.backlogCount - 1}"]`)).toHaveAttribute("aria-posinset", String(DRAG_LAB.backlogCount));
});

test("the new issue dialog starts in the title and traps focus", async ({ page }) => {
  await login(page);
  await page.keyboard.press("c");
  const dialog = page.getByRole("dialog", { name: "New issue" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Orbit");
  const title = page.getByPlaceholder("Issue title");
  await expect(title).toBeFocused();
  await title.fill("Focus check");
  await dialog.getByRole("button", { name: "Create issue" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Create issue" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("the password form names its fields and focuses the mismatched confirmation", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account/);
  const form = page.getByRole("form", { name: "Change password" });
  await expect(form).toBeVisible();
  const current = page.getByLabel("Current password");
  const next = page.getByLabel("New password", { exact: true });
  const confirm = page.getByLabel("Confirm new password");
  await expect(current).toHaveAttribute("autocomplete", "current-password");
  const describedBy = await next.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText("At least 8 characters.");
  await current.fill("demo1234");
  await next.fill("password456");
  await confirm.fill("password999");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("alert")).toHaveText("Passwords do not match");
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveAttribute("aria-invalid", "true");
});
