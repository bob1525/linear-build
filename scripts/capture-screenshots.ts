import path from "node:path";
import { mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { chromium, type Browser, type Page } from "@playwright/test";
import { DEMO_PASSWORD, DEMO_USERS, PRIMARY_DEMO } from "../src/lib/demo-accounts";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const outDir = "docs/screenshots";
const viewName = "Todo + high";

async function signIn(page: Page, email: string = PRIMARY_DEMO.email) {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/p/**");
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${name}` });
}

async function deleteByTitle(fragment: string) {
  const client = new PrismaClient({
    datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "dev.db")}` } },
  });
  try {
    await client.issue.deleteMany({ where: { title: { contains: fragment } } });
  } finally {
    await client.$disconnect();
  }
}

async function captureConflict(browser: Browser) {
  const token = "Conflict shot";
  const original = "Conflict shot original";
  const marcusTitle = "Conflict shot from Marcus";
  const avaContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const marcusContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const ava = await avaContext.newPage();
  const marcus = await marcusContext.newPage();
  try {
    await deleteByTitle(token);
    await signIn(ava);
    await ava.getByRole("button", { name: "New issue" }).click();
    await ava.getByPlaceholder("Issue title").fill(original);
    await ava.getByRole("button", { name: "Create issue" }).click();
    await ava.getByRole("dialog", { name: "New issue" }).waitFor({ state: "hidden" });
    await ava.getByRole("link", { name: original }).click();
    await ava.getByLabel("Title").waitFor();
    const url = ava.url();

    await signIn(marcus, DEMO_USERS[1]!.email);
    await marcus.goto(url, { waitUntil: "networkidle" });
    await marcus.getByLabel("Title").fill(marcusTitle);
    await marcus.getByLabel("Title").press("Enter");
    await marcus.getByText("renamed the issue").waitFor();

    await ava.getByLabel("Title").fill("Conflict shot from Ava");
    await ava.getByLabel("Title").press("Enter");
    await ava.getByTestId("conflict-prompt").waitFor();
    await shot(ava, "conflict-dialog.png");
  } finally {
    await avaContext.close();
    await marcusContext.close();
    await deleteByTitle(token);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await shot(page, "login.png");

  await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/p/ORB");
  await page.getByRole("heading", { name: "Orbit" }).waitFor();
  await shot(page, "board.png");

  const blocked = page.locator("[data-blocked='true']").first();
  const blocks = page.locator("[data-blocks='true']").first();
  await blocked.waitFor();
  await blocks.waitFor();
  await blocked.scrollIntoViewIfNeeded();
  await blocks.scrollIntoViewIfNeeded();
  await shot(page, "board-with-relations.png");

  await page.getByTestId("filter-status").click();
  await page.getByRole("option", { name: "Todo" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("filter-priority").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("search").fill("cache");
  await page.waitForTimeout(500);
  await shot(page, "filters.png");

  await page.getByTestId("saved-views").click();
  const existing = page.getByRole("link", { name: viewName, exact: true });
  if (await existing.count()) {
    await page.getByRole("button", { name: `Delete ${viewName}` }).click();
    await existing.waitFor({ state: "hidden" });
  }
  await page.getByTestId("view-name").fill(viewName);
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByRole("link", { name: viewName, exact: true }).waitFor();
  await shot(page, "saved-views-menu.png");
  await page.getByRole("button", { name: `Delete ${viewName}` }).click();
  await page.getByRole("link", { name: viewName, exact: true }).waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");

  await page.goto(`${baseURL}/p/ORB/list`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Orbit" }).waitFor();
  await shot(page, "list.png");

  await page.getByTestId("select-ORB-2").click();
  await page.getByTestId("select-ORB-3").click();
  await page.getByTestId("selection-count").waitFor();
  await page.getByTestId("batch-status").waitFor();
  await shot(page, "batch-operations.png");

  await page.goto(`${baseURL}/p/ORB/issues/1`, { waitUntil: "networkidle" });
  await page.locator("#issue-title").waitFor();
  await page.getByTestId("properties").waitFor();
  await shot(page, "issue-detail.png");

  const relations = page.locator("[aria-label='Relations']");
  await page.getByTestId("relations-subissues").getByText("ORB-5").waitFor();
  await relations.evaluate((node) => node.scrollIntoView({ block: "start" }));
  await shot(page, "issue-detail-relations.png");

  await page.goto(`${baseURL}/p/RLY`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Relay" }).waitFor();
  await page.getByRole("link", { name: "Relay backlog 01" }).waitFor();
  await page.getByRole("link", { name: "Relay short todo" }).waitFor();
  await page.getByTestId("column-in_progress").getByText("No issues").waitFor();
  await shot(page, "relay-drag-lab.png");

  await page.close();
  await captureConflict(browser);

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
