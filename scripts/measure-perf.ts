import { chromium, type Page } from "playwright";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";

const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function percentile(values: number[], p: number) {
  const sorted = [...values].filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function login(page: Page) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("perf@northstar.dev");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/p\/PERF/);
}

async function boardReady(page: Page) {
  await page.getByRole("heading", { name: "Todo" }).waitFor();
  await page.getByRole("link", { name: "Perf 002" }).waitFor();
}

async function columnTotal(page: Page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll("[data-testid^='column-'] header span:last-child")]
      .map((node) => Number(node.textContent ?? "0"))
      .reduce((sum, value) => sum + value, 0);
  });
}

async function loadBoard(page: Page) {
  const started = Date.now();
  await page.goto(`${baseURL}/p/PERF?all=1`, { waitUntil: "domcontentloaded" });
  await boardReady(page);
  const elapsed = Date.now() - started;
  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      ttfbMs: entry ? Math.round(entry.responseStart) : null,
      domContentLoadedMs: entry ? Math.round(entry.domContentLoadedEventEnd) : null,
      loadMs: entry ? Math.round(entry.loadEventEnd) : null,
      transferBytes: entry?.transferSize ?? null,
    };
  });
  const issues = await columnTotal(page);
  return { elapsed, issues, ...navigation };
}

async function filterBySearch(page: Page) {
  await page.goto(`${baseURL}/p/PERF?all=1`);
  await boardReady(page);
  const field = page.getByTestId("search");
  const started = Date.now();
  await field.fill("Perf 250");
  await page.waitForURL(/q=Perf(\+|%20)250/);
  await page.getByRole("link", { name: "Perf 250", exact: true }).waitFor();
  const elapsed = Date.now() - started;
  const shown = await columnTotal(page);
  await field.fill("");
  await page.waitForURL((url) => !url.search.includes("q="));
  await boardReady(page);
  return { elapsed, shown };
}

async function filterByPriority(page: Page) {
  await page.goto(`${baseURL}/p/PERF?all=1`);
  await boardReady(page);
  await page.getByTestId("filter-priority").click();
  const started = Date.now();
  await page.getByRole("option", { name: "High", exact: true }).click();
  await page.waitForURL(/priority=high/);
  await page.getByRole("link", { name: "Perf 004" }).waitFor();
  const elapsed = Date.now() - started;
  const shown = await columnTotal(page);
  return { elapsed, shown };
}

async function dragOnce(page: Page, title: string) {
  await page.goto(`${baseURL}/p/PERF?all=1`);
  await boardReady(page);
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await card.evaluate(
    new Function(
      "node",
      `const scroller = node.closest("[data-column-scroll]");
       if (!(scroller instanceof HTMLElement)) return;
       const itemRect = node.getBoundingClientRect();
       const scrollerRect = scroller.getBoundingClientRect();
       scroller.scrollTop += itemRect.top - scrollerRect.top - (scroller.clientHeight - itemRect.height) / 2;`,
    ) as (node: HTMLElement) => void,
  );
  await page.evaluate(
    new Function(
      `const gaps = [];
       let last = performance.now();
       const loop = (now) => {
         gaps.push(now - last);
         last = now;
         window.__perfRaf = requestAnimationFrame(loop);
       };
       window.__perfGaps = gaps;
       window.__perfRaf = requestAnimationFrame(loop);`,
    ) as () => void,
  );

  const handle = card.getByRole("button", { name: /^Drag / });
  const handleBox = await handle.boundingBox();
  const column = page.getByTestId("column-done");
  const columnBox = await column.boundingBox();
  if (!handleBox || !columnBox) throw new Error("Could not measure the perf drag");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = columnBox.x + columnBox.width / 2;
  const endY = columnBox.y + 120;
  const gestureStarted = Date.now();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 24 });
  await page.mouse.up();
  const gestureMs = Date.now() - gestureStarted;
  const settleStarted = Date.now();
  await column.getByRole("link", { name: "Perf 002", exact: true }).waitFor();
  const settleMs = Date.now() - settleStarted;

  const gaps = await page.evaluate(
    new Function(
      `if (window.__perfRaf) cancelAnimationFrame(window.__perfRaf);
       return window.__perfGaps || [];`,
    ) as () => number[],
  );
  return {
    gestureMs,
    settleMs,
    frames: gaps.length,
    frameP50Ms: Math.round(percentile(gaps, 0.5) * 10) / 10,
    frameP95Ms: Math.round(percentile(gaps, 0.95) * 10) / 10,
    frameMaxMs: Math.round(Math.max(...gaps, 0) * 10) / 10,
  };
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);
  const loads = [await loadBoard(page), await loadBoard(page), await loadBoard(page)];
  const searches = [await filterBySearch(page), await filterBySearch(page), await filterBySearch(page)];
  const priorities = [await filterByPriority(page), await filterByPriority(page), await filterByPriority(page)];
  const drags = [await dragOnce(page, "Perf 002"), await dragOnce(page, "Perf 006")];
  const report = {
    baseURL,
    viewport: "1440x900",
    issues: loads[0]?.issues ?? 0,
    boardLoadMs: loads.map((item) => item.elapsed),
    boardLoadMedianMs: median(loads.map((item) => item.elapsed)),
    navigation: loads,
    searchFilterMs: searches.map((item) => item.elapsed),
    searchFilterMedianMs: median(searches.map((item) => item.elapsed)),
    searchShown: searches.map((item) => item.shown),
    priorityFilterMs: priorities.map((item) => item.elapsed),
    priorityFilterMedianMs: median(priorities.map((item) => item.elapsed)),
    priorityShown: priorities.map((item) => item.shown),
    drags,
  };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
