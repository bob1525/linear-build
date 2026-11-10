import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD, PRIMARY_DEMO } from "../src/lib/demo-accounts";

export async function login(page: Page, email = PRIMARY_DEMO.email, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/p\/ORB/);
}

export async function scrollColumn(page: Page, status: string, position: "start" | "middle" | "end") {
  const scroller = page.getByTestId(`column-scroll-${status}`);
  await scroller.evaluate((node, where) => {
    const element = node as HTMLElement;
    if (where === "start") element.scrollTop = 0;
    else if (where === "end") element.scrollTop = element.scrollHeight;
    else element.scrollTop = element.scrollHeight / 2;
  }, position);
  const top = await scroller.evaluate((node) => (node as HTMLElement).scrollTop);
  if (position !== "start" && top < 40) throw new Error(`Column ${status} did not scroll (${top}px)`);
  return top;
}

export async function scrollBoard(page: Page, left: number | "end") {
  const board = page.getByTestId("board-scroll");
  await board.evaluate((node, value) => {
    const element = node as HTMLElement;
    element.scrollLeft = value === "end" ? element.scrollWidth : value;
  }, left);
  const scrolled = await board.evaluate((node) => (node as HTMLElement).scrollLeft);
  if (scrolled < 40) throw new Error(`Board did not scroll horizontally (${scrolled}px)`);
  return scrolled;
}

export async function dragCard(page: Page, title: string, status: string, yRatio = 0.42, beforeRelease?: () => Promise<void>) {
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: title, exact: true }) });
  const handle = card.getByRole("button", { name: /^Drag / });
  // offsetTop is relative to the body (no positioned ancestor), so it cannot be used as scrollTop.
  await card.evaluate((node) => {
    const scroller = node.closest("[data-column-scroll]");
    if (!(scroller instanceof HTMLElement)) return;
    const itemRect = node.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    scroller.scrollTop += itemRect.top - scrollerRect.top - (scroller.clientHeight - itemRect.height) / 2;
    const board = node.closest("[data-testid='board-scroll']");
    if (!(board instanceof HTMLElement)) return;
    const next = node.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    if (next.left < boardRect.left + 8) board.scrollLeft -= boardRect.left + 8 - next.left;
    else if (next.right > boardRect.right - 8) board.scrollLeft += next.right - (boardRect.right - 8);
  });
  const handleBox = await handle.boundingBox();
  const columnBox = await page.getByTestId(`column-${status}`).boundingBox();
  const boardBox = await page.getByTestId("board-scroll").boundingBox();
  if (!handleBox || !columnBox || !boardBox) throw new Error(`Could not measure the drag from "${title}" to ${status}`);
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const onHandle = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit?.closest("button")?.getAttribute("aria-label")?.startsWith("Drag "));
  }, { x: startX, y: startY });
  if (!onHandle) throw new Error(`Drag handle for "${title}" is covered at ${Math.round(startX)},${Math.round(startY)}`);
  const visibleLeft = Math.max(columnBox.x + 20, boardBox.x + 12);
  const visibleRight = Math.min(columnBox.x + columnBox.width - 20, boardBox.x + boardBox.width - 12);
  if (visibleRight <= visibleLeft) throw new Error(`Column ${status} is not visible enough to drop on`);
  const endX = (visibleLeft + visibleRight) / 2;
  const endY = columnBox.y + Math.min(columnBox.height - 24, Math.max(78, columnBox.height * yRatio));
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 16, startY + 12, { steps: 6 });
  await page.mouse.move(endX, endY, { steps: 20 });
  if (beforeRelease) await beforeRelease();
  await page.mouse.up();
}
