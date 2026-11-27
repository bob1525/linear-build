import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { PRIMARY_DEMO } from "../src/lib/demo-accounts";
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

async function scrollList(page: Page, position: "start" | "end") {
  const scroller = page.getByTestId("list-scroll");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await scroller.evaluate((node, where) => {
      const element = node as HTMLElement;
      element.scrollTop = where === "start" ? 0 : element.scrollHeight;
    }, position);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
  return scroller.evaluate((node) => (node as HTMLElement).scrollTop);
}

test("mounts a slice of a long list, selects every row, and opens the last issue", async ({ page }) => {
  const token = `ListWin${Date.now()}`;
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
    await expect(scroller).toHaveAttribute("data-list-size", String(ROW_COUNT));
    await expect(scroller).toHaveAttribute("data-virtualized", "true");
    await expect.poll(async () => scroller.locator("[data-testid^='row-']").count()).toBeLessThan(ROW_COUNT);
    const header = page.getByTestId("list-scroll").locator("xpath=preceding-sibling::*[1]");
    await expect(page.getByRole("link", { name: first, exact: true })).toBeVisible();
    await expect(header.getByText("Title", { exact: true })).toBeVisible();

    await page.getByTestId("select-all").click();
    await expect(page.getByTestId("selection-count")).toHaveText(`${ROW_COUNT} selected`);
    await expect(scroller.locator("[data-testid^='row-']").first().getByRole("checkbox")).toBeChecked();

    const scrolled = await scrollList(page, "end");
    expect(scrolled).toBeGreaterThan(80);
    await expect(page.getByRole("link", { name: last, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: first, exact: true })).toHaveCount(0);
    await expect.poll(async () => scroller.locator("[data-testid^='row-']").count()).toBeLessThan(ROW_COUNT);
    await expect(scroller).toHaveAttribute("data-list-size", String(ROW_COUNT));
    await expect(page.getByTestId("selection-count")).toHaveText(`${ROW_COUNT} selected`);
    await expect(page.getByRole("checkbox", { name: new RegExp(`Select ORB-`) }).last()).toBeChecked();
    await expect(header.getByText("Title", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: last, exact: true }).click();
    await expect(page).toHaveURL(/\/p\/ORB\/issues\/\d+$/);
    await expect(page.locator("#issue-title")).toHaveValue(last);
  } finally {
    await cleanup(token);
  }
});
