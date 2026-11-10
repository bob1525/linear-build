import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { DEMO_PASSWORD, PRIMARY_DEMO } from "../src/lib/demo-accounts";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const outDir = "docs/screenshots";

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/login.png` });

  await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/p/ORB");
  await page.getByRole("heading", { name: "Orbit" }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/board.png` });

  await page.getByTestId("filter-status").click();
  await page.getByRole("option", { name: "Todo" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("filter-priority").click();
  await page.getByRole("option", { name: "High" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("search").fill("cache");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/filters.png` });

  await page.goto(`${baseURL}/p/ORB/list`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Orbit" }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/list.png` });

  await page.goto(`${baseURL}/p/ORB/issues/1`, { waitUntil: "networkidle" });
  await page.locator("#issue-title").waitFor();
  await page.getByTestId("properties").waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/issue-detail.png` });

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
