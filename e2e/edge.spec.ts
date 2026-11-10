import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, DEMO_USERS } from "../src/lib/demo-accounts";
import { login } from "./helpers";

function e2eDb() {
  return new PrismaClient({
    datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "e2e.db")}` } },
  });
}

async function withDb(run: (client: PrismaClient) => Promise<unknown>) {
  const client = e2eDb();
  try {
    await run(client);
  } finally {
    await client.$disconnect();
  }
}

async function signup(page: Page, email: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/welcome/);
}

test("an empty project shows an empty board and an empty list", async ({ page }) => {
  const key = `Z${Date.now().toString(36).slice(-3)}`.toUpperCase();
  const email = `empty.${Date.now()}@example.com`;
  try {
    await signup(page, email, "Empty Tester");
    await page.getByLabel("Project name").fill("Empty Lab");
    await page.getByLabel("Key").fill(key);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${key}`));
    await expect(page.getByRole("heading", { name: "No issues yet" })).toBeVisible();
    await page.locator("header").getByRole("link", { name: "List", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${key}/list`));
    await expect(page.getByRole("heading", { name: "No issues yet" })).toBeVisible();
  } finally {
    await withDb((client) => client.project.deleteMany({ where: { key } }));
  }
});

test("logged-out visitors and non-members cannot open Orbit", async ({ page }) => {
  await page.goto("/p/ORB");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in to Northstar" })).toBeVisible();

  const email = `outsider.${Date.now()}@example.com`;
  await signup(page, email, "Outsider");
  await page.goto("/p/ORB");
  await expect(page.getByRole("heading", { name: "That page is not in this workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to your projects" })).toBeVisible();
});

test("a title keeps markup, quotes, and non-latin text as text", async ({ page }) => {
  const token = `Chars${Date.now()}`;
  const title = `${token} <script>alert(1)</script> "quotes" & 你好`;
  let sawDialog = false;
  page.on("dialog", async (dialog) => {
    sawDialog = true;
    await dialog.dismiss();
  });
  try {
    await login(page);
    await page.getByRole("button", { name: "New issue" }).click();
    await page.getByPlaceholder("Issue title").fill(title);
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();
    await page.getByTestId("saved-views").click();
    await page.getByTestId("view-name").fill(`${token} & <view>`);
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(page.getByText(`${token} & <view>`)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    const comment = `${token} Tom & Jerry "quotes" 你好`;
    await page.getByLabel("Comment").fill(comment);
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(page.getByTestId("comments")).toContainText(comment);
    expect(sawDialog).toBe(false);
  } finally {
    await withDb(async (client) => {
      await client.issue.deleteMany({ where: { title: { startsWith: token } } });
      await client.savedView.deleteMany({ where: { name: { contains: token } } });
    });
  }
});

test("a 200 character title and a long description save and render", async ({ page }) => {
  const token = `Long${Date.now()}`;
  const title = `${token} ${"T".repeat(200)}`.slice(0, 200);
  const marker = `${token}-END`;
  const description = `${"detail ".repeat(1200)}${marker}`;
  try {
    await login(page);
    await page.getByRole("button", { name: "New issue" }).click();
    const titleField = page.getByPlaceholder("Issue title");
    await titleField.fill("x".repeat(250));
    await expect(titleField).toHaveValue("x".repeat(200));
    await titleField.fill(title);
    await page.getByPlaceholder("Add a description…").fill(description);
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expect(page.getByText(marker)).toBeVisible();
    expect(title.length).toBe(200);
    expect(description.length).toBeGreaterThan(5000);
  } finally {
    await withDb((client) => client.issue.deleteMany({ where: { title: { startsWith: token } } }));
  }
});

test("the later saver of an issue gets a conflict prompt", async ({ browser }) => {
  const token = `Conflict${Date.now()}`;
  const original = `${token} original`;
  const marcusTitle = `${token} marcus`;
  const marcusAgain = `${token} marcus again`;
  const avaTitle = `${token} ava`;
  const avaContext = await browser.newContext();
  const marcusContext = await browser.newContext();
  const ava = await avaContext.newPage();
  const marcus = await marcusContext.newPage();
  try {
    await login(ava);
    await ava.getByRole("button", { name: "New issue" }).click();
    await ava.getByPlaceholder("Issue title").fill(original);
    await ava.getByRole("button", { name: "Create issue" }).click();
    await expect(ava.getByRole("dialog", { name: "New issue" })).toBeHidden();
    await ava.getByRole("link", { name: original }).click();
    await expect(ava.getByLabel("Title")).toHaveValue(original);
    const url = ava.url();

    await login(marcus, DEMO_USERS[1]!.email, DEMO_PASSWORD);
    await marcus.goto(url);
    await expect(marcus.getByLabel("Title")).toHaveValue(original);
    await marcus.getByLabel("Title").fill(marcusTitle);
    await marcus.getByLabel("Title").press("Enter");
    await expect(marcus.getByText("renamed the issue")).toHaveCount(1);

    await ava.getByLabel("Title").fill(`${token} reload me`);
    await ava.getByLabel("Title").press("Enter");
    const prompt = ava.getByTestId("conflict-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("Marcus Hale");
    await prompt.getByTestId("conflict-reload").click();
    await expect(prompt).toBeHidden();
    await expect(ava.getByLabel("Title")).toHaveValue(marcusTitle);

    await marcus.getByLabel("Title").fill(marcusAgain);
    await marcus.getByLabel("Title").press("Enter");
    await expect(marcus.getByText("renamed the issue")).toHaveCount(2);

    await ava.getByLabel("Title").fill(avaTitle);
    await ava.getByLabel("Title").press("Enter");
    await expect(ava.getByTestId("conflict-prompt")).toBeVisible();
    await ava.getByTestId("conflict-overwrite").click();
    await expect(ava.getByTestId("conflict-prompt")).toBeHidden();
    await ava.reload();
    await expect(ava.getByLabel("Title")).toHaveValue(avaTitle);
    await expect(marcus.getByLabel("Title")).toHaveValue(marcusAgain);
  } finally {
    await avaContext.close();
    await marcusContext.close();
    await withDb((client) => client.issue.deleteMany({ where: { title: { contains: token } } }));
  }
});

test("a delayed save shows creating and batch progress before it finishes", async ({ page }) => {
  const token = `Slow${Date.now()}`;
  try {
    await login(page);
    await page.route("**/*", async (route) => {
      const action = route.request().headers()["next-action"];
      if (route.request().method() === "POST" && action) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "New issue" }).click();
    await page.getByPlaceholder("Issue title").fill(`${token} one`);
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByRole("button", { name: "Creating…" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();

    await page.getByRole("button", { name: "New issue" }).click();
    await page.getByPlaceholder("Issue title").fill(`${token} two`);
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByRole("button", { name: "Creating…" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "New issue" })).toBeHidden();

    await page.getByTestId("search").fill(token);
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect(page.getByRole("link", { name: `${token} one` })).toBeVisible();
    await expect(page.getByRole("link", { name: `${token} two` })).toBeVisible();
    await page.getByTestId("select-all").click();
    await page.getByTestId("batch-status").click();
    await page.getByTestId("batch-status-done").click();
    await expect(page.getByTestId("batch-progress")).toHaveText("Updating 2 issues…");
    await expect(page.getByTestId("batch-result")).toContainText("2 succeeded, 0 failed");
  } finally {
    await page.unroute("**/*").catch(() => undefined);
    await withDb((client) => client.issue.deleteMany({ where: { title: { startsWith: token } } }));
  }
});
