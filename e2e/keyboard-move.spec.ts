import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { DRAG_LAB, PRIMARY_DEMO } from "../src/lib/demo-accounts";
import { login } from "./helpers";

function e2eDb() {
  return new PrismaClient({
    datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "e2e.db")}` } },
  });
}

async function cleanup(title: string) {
  const client = e2eDb();
  try {
    await client.issue.deleteMany({ where: { title } });
  } finally {
    await client.$disconnect();
  }
}

async function insert(title: string, status: "todo" | "backlog") {
  const client = e2eDb();
  try {
    const project = await client.project.findUnique({ where: { key: DRAG_LAB.key } });
    const user = await client.user.findUnique({ where: { email: PRIMARY_DEMO.email } });
    if (!project || !user) throw new Error("Relay seed is missing");
    const last = await client.issue.aggregate({ where: { projectId: project.id }, _max: { number: true } });
    await client.issue.create({
      data: {
        projectId: project.id,
        number: (last._max.number ?? 0) + 1,
        title,
        status,
        priority: "urgent",
        creatorId: user.id,
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test("alt and the arrow keys move a focused card between columns", async ({ page }) => {
  const title = `KeyMove ${Date.now()}`;
  try {
    await cleanup(title);
    await insert(title, "todo");
    await login(page);
    await page.goto("/p/RLY");

    const link = page.getByRole("link", { name: title, exact: true });
    await expect(page.getByTestId("column-todo").getByRole("link", { name: title, exact: true })).toBeVisible();
    await link.focus();

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("column-backlog").locator(":focus")).toHaveCount(1);
    await expect(page.getByTestId("column-todo").getByRole("link", { name: title, exact: true })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(link).toBeFocused();
    await page.keyboard.press("Alt+ArrowRight");
    const moved = page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true });
    await expect(moved).toBeFocused();
    await expect(page.getByTestId("column-todo").getByRole("link", { name: title, exact: true })).toHaveCount(0);
    await expect(page.getByTestId("column-in_progress")).toContainText("In Progress");
    await expect(page.getByTestId("board-move-status")).toContainText("moved to In Progress");

    await page.reload();
    await expect(page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true })).toBeVisible();
    await page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByText("changed status from Todo to In Progress")).toBeVisible();

    await page.goto("/p/RLY");
    const inProgress = page.getByTestId("column-in_progress").getByRole("link", { name: title, exact: true });
    await inProgress.focus();
    await page.keyboard.press("Alt+ArrowRight");
    const inDone = page.getByTestId("column-done").getByRole("link", { name: title, exact: true });
    await expect(inDone).toBeFocused();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(inDone).toBeFocused();
    await expect(page.getByTestId("board-move-status")).toHaveText("Done is the last column");
    await expect(page.getByTestId("column-done").getByRole("link", { name: title, exact: true })).toBeVisible();
  } finally {
    await cleanup(title);
  }
});

test("alt and the left arrow does not move a card out of Backlog", async ({ page }) => {
  const title = `KeyMove edge ${Date.now()}`;
  try {
    await cleanup(title);
    await insert(title, "backlog");
    await login(page);
    await page.goto("/p/RLY");
    const first = page.getByTestId("column-backlog").getByRole("link", { name: title, exact: true });
    await expect(first).toBeVisible();
    await first.focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(first).toBeFocused();
    await expect(page.getByTestId("column-backlog").getByRole("link", { name: title, exact: true })).toBeVisible();
    await expect(page.getByTestId("board-move-status")).toHaveText("Backlog is the first column");
  } finally {
    await cleanup(title);
  }
});
