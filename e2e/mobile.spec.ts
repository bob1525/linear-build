import { expect, test, type Locator } from "@playwright/test";
import { DRAG_LAB } from "../src/lib/demo-accounts";
import { login } from "./helpers";

async function visibleArea(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const width = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const height = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    return { width, height };
  });
}

async function onScreen(locator: Locator) {
  const area = await visibleArea(locator);
  return area.width > 24 && area.height > 16;
}

test("sidebar opens and closes on a narrow screen", async ({ page }) => {
  await login(page);
  const aside = page.locator("aside");
  const openMenu = page.getByRole("button", { name: "Open menu" });
  const orbit = page.getByRole("link", { name: /^Orbit/ });
  await expect(openMenu).toBeVisible();
  await expect.poll(async () => (await aside.boundingBox())?.x ?? 0).toBeLessThan(-200);
  expect(await onScreen(orbit)).toBe(false);

  await openMenu.click();
  const overlay = page.locator("button[aria-label='Close menu'].fixed");
  await expect(overlay).toBeVisible();
  await expect.poll(async () => (await aside.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
  await expect.poll(() => onScreen(page.getByRole("navigation", { name: "Projects" }))).toBe(true);
  await expect.poll(() => onScreen(orbit)).toBe(true);

  await overlay.click();
  await expect(overlay).toBeHidden();
  await expect(openMenu).toBeVisible();
  await expect.poll(async () => (await aside.boundingBox())?.x ?? 0).toBeLessThan(-200);
  expect(await onScreen(orbit)).toBe(false);
});

test("board scrolls horizontally on a narrow screen and cards stay visible", async ({ page }) => {
  await login(page);
  await page.goto(`/p/${DRAG_LAB.key}?all=1`);
  await expect(page.getByRole("heading", { name: DRAG_LAB.name })).toBeVisible();

  const board = page.getByTestId("board-scroll");
  const backlog = page.getByTestId("column-backlog").getByRole("link", { name: DRAG_LAB.backlog(1), exact: true });
  const done = page.getByTestId("column-done").getByRole("link", { name: DRAG_LAB.done(1), exact: true });
  await expect(backlog).toBeVisible();
  await expect.poll(() => onScreen(backlog)).toBe(true);
  expect(await onScreen(done)).toBe(false);

  const overflow = await board.evaluate((node) => {
    const element = node as HTMLElement;
    return element.scrollWidth - element.clientWidth;
  });
  expect(overflow).toBeGreaterThan(80);

  await board.evaluate((node) => {
    const element = node as HTMLElement;
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(() => board.evaluate((node) => (node as HTMLElement).scrollLeft)).toBeGreaterThan(80);
  await expect.poll(() => onScreen(done)).toBe(true);
  expect(await onScreen(backlog)).toBe(false);
});
