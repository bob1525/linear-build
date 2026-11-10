import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD, PRIMARY_DEMO } from "../src/lib/demo-accounts";

export async function login(page: Page, email = PRIMARY_DEMO.email, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/p\/ORB/);
}

export async function dragCard(page: Page, title: string, status: string) {
  const card = page.locator("article", { hasText: title });
  const handle = card.getByRole("button", { name: /^Drag / });
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const column = page.getByTestId(`column-${status}`);
  const columnBox = await column.boundingBox();
  if (!handleBox || !columnBox) throw new Error("Could not measure the drag target");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 16, startY + 12, { steps: 6 });
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 20 });
  await page.mouse.up();
}
