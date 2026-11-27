import { expect, type Page, test } from "@playwright/test";
import { DRAG_LAB } from "../src/lib/demo-accounts";
import { dragCard, login, scrollBoard, scrollColumn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto("/p/RLY");
  await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();
});

async function expectInColumn(page: Page, status: string, title: string) {
  await expect(page.getByTestId(`column-${status}`).getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(page.locator("article").filter({ has: page.getByRole("link", { name: title, exact: true }) })).toHaveCount(1);
}

function waitForSaves(page: Page, count: number) {
  return new Promise<void>((resolve, reject) => {
    let seen = 0;
    const timer = setTimeout(() => {
      page.off("response", onResponse);
      reject(new Error(`Expected ${count} saved drags, saw ${seen}`));
    }, 15_000);
    function onResponse(response: { ok: () => boolean; request: () => { method: () => string } }) {
      if (response.request().method() !== "POST" || !response.ok()) return;
      seen += 1;
      if (seen < count) return;
      clearTimeout(timer);
      page.off("response", onResponse);
      resolve();
    }
    page.on("response", onResponse);
  });
}

async function clearColumn(page: Page, status: string, parking: string) {
  for (let guard = 0; guard < 24; guard += 1) {
    const card = page.getByTestId(`column-${status}`).locator("article a").first();
    if ((await page.getByTestId(`column-${status}`).locator("article").count()) === 0) return;
    const title = await card.innerText();
    await dragCard(page, title, parking, 0.3);
    await expectInColumn(page, parking, title);
  }
  throw new Error(`Could not empty ${status}`);
}

test("shows a placeholder and highlights the column under the pointer", async ({ page }) => {
  const title = DRAG_LAB.backlog(1);
  await dragCard(page, title, "todo", 0.45, async () => {
    await expect(page.getByTestId("column-todo")).toHaveAttribute("data-drop-target", "true");
    await expect(page.getByTestId("drop-slot-todo")).toBeVisible();
    await expect(page.locator(`[data-placeholder='true']`).filter({ hasText: title })).toBeVisible();
    await expect(page.getByTestId("column-in_progress")).toHaveAttribute("data-drop-target", "false");
  });
  await expectInColumn(page, "todo", title);
});

test("drops on a short column after the source column is scrolled", async ({ page }) => {
  const title = DRAG_LAB.backlog(12);
  const scrolled = await scrollColumn(page, "backlog", "end");
  expect(scrolled).toBeGreaterThan(80);
  await dragCard(page, title, "todo", 0.5);
  await expectInColumn(page, "todo", title);
  await expect(page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("drops in the lower empty area of a short column after scrolling the source", async ({ page }) => {
  const title = DRAG_LAB.backlog(11);
  await scrollColumn(page, "backlog", "middle");
  await dragCard(page, title, "todo", 0.82);
  await expectInColumn(page, "todo", title);
  await expect(page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("drops on a column whose cards are scrolled", async ({ page }) => {
  const title = DRAG_LAB.backlog(10);
  const scrolled = await scrollColumn(page, "done", "end");
  expect(scrolled).toBeGreaterThan(40);
  await dragCard(page, title, "done", 0.78);
  await expectInColumn(page, "done", title);
  await expect(page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("drops from a long column onto a short column", async ({ page }) => {
  const title = DRAG_LAB.backlog(9);
  await scrollColumn(page, "backlog", "end");
  await dragCard(page, title, "todo", 0.7);
  await expectInColumn(page, "todo", title);
});

test("drops into an empty column", async ({ page }) => {
  const title = DRAG_LAB.done(1);
  await clearColumn(page, "in_progress", "done");
  await expect(page.getByTestId("column-in_progress")).toContainText("No issues");
  await dragCard(page, title, "in_progress", 0.55);
  await expectInColumn(page, "in_progress", title);
});

test("drops into an empty column after the board is scrolled horizontally", async ({ page }) => {
  const title = DRAG_LAB.done(2);
  await clearColumn(page, "in_progress", "done");
  await page.setViewportSize({ width: 1000, height: 720 });
  const scrolled = await scrollBoard(page, "end");
  expect(scrolled).toBeGreaterThan(80);
  await dragCard(page, title, "in_progress", 0.6);
  await expectInColumn(page, "in_progress", title);
});

test("drops on the column under the pointer after horizontal scroll", async ({ page }) => {
  const title = DRAG_LAB.done(3);
  await page.setViewportSize({ width: 1000, height: 720 });
  await scrollBoard(page, "end");
  await dragCard(page, title, "in_progress", 0.4);
  await expectInColumn(page, "in_progress", title);
  await expect(page.getByTestId("column-done").getByRole("link", { name: title, exact: true })).toHaveCount(0);
  await expect(page.getByTestId("column-todo").getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("drops on a partially visible column after horizontal scroll", async ({ page }) => {
  const title = DRAG_LAB.short;
  await page.setViewportSize({ width: 1000, height: 720 });
  await scrollBoard(page, 120);
  const column = await page.getByTestId("column-in_progress").boundingBox();
  const board = await page.getByTestId("board-scroll").boundingBox();
  expect(column).not.toBeNull();
  expect(board).not.toBeNull();
  expect(column!.x).toBeLessThan(board!.x + board!.width);
  expect(column!.x + column!.width).toBeGreaterThan(board!.x + board!.width);
  await dragCard(page, title, "in_progress", 0.4);
  await expectInColumn(page, "in_progress", title);
});

test("keeps two fast drags after a reload", async ({ page }) => {
  const first = DRAG_LAB.backlog(6);
  const second = DRAG_LAB.backlog(7);
  const saved = waitForSaves(page, 2);
  await dragCard(page, first, "done", 0.35);
  await dragCard(page, second, "done", 0.48);
  await expectInColumn(page, "done", first);
  await expectInColumn(page, "done", second);
  await saved;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();
  await expectInColumn(page, "done", first);
  await expectInColumn(page, "done", second);
});

test("keeps a second drag of the same card after a reload", async ({ page }) => {
  const title = DRAG_LAB.backlog(5);
  const saved = waitForSaves(page, 2);
  await dragCard(page, title, "todo", 0.4);
  await expectInColumn(page, "todo", title);
  await dragCard(page, title, "done", 0.45);
  await expectInColumn(page, "done", title);
  await saved;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();
  await expectInColumn(page, "done", title);
  await expect(page.getByTestId("column-todo").getByRole("link", { name: title, exact: true })).toHaveCount(0);
});
