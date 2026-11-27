import { expect, test } from "@playwright/test";
import { DRAG_LAB } from "../src/lib/demo-accounts";
import { login, scrollColumn } from "./helpers";

test("mounts the visible slice of a long column and the card at the end after scrolling", async ({ page }) => {
  await login(page);
  await page.goto("/p/RLY");
  await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();

  const column = page.getByTestId("column-backlog");
  const scroller = page.getByTestId("column-scroll-backlog");
  const size = Number(await column.locator("header span").innerText());
  expect(size).toBe(DRAG_LAB.backlogCount);
  await expect(scroller).toHaveAttribute("data-virtualized", "true");
  await expect.poll(async () => scroller.locator("article").count()).toBeLessThan(size);
  await expect(page.getByRole("link", { name: DRAG_LAB.backlog(1), exact: true })).toBeVisible();

  const scrolled = await scrollColumn(page, "backlog", "end");
  expect(scrolled).toBeGreaterThan(80);
  await expect(page.getByRole("link", { name: DRAG_LAB.backlog(12), exact: true })).toBeVisible();
  await expect.poll(async () => scroller.locator("article").count()).toBeLessThan(size);
  await expect(page.getByRole("link", { name: DRAG_LAB.backlog(1), exact: true })).toHaveCount(0);
  await expect(column.locator("header span")).toHaveText(String(size));
});
