import { readFileSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, PRIMARY_DEMO } from "../src/lib/demo-accounts";

const outbox = ".mail/e2e-outbox.jsonl";

function resetLink() {
  const lines = readFileSync(outbox, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
  const last = JSON.parse(lines[lines.length - 1] ?? "{}") as { text?: string };
  const link = last.text?.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("The outbox has no reset link");
  return link;
}

test("a reset link from the outbox changes the password and signs out the other session", async ({ page, browser }) => {
  rmSync(outbox, { force: true });
  const next = "reset-password-456";
  await page.goto("/login");
  await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/p\/ORB/);

  const baseURL = test.info().project.use.baseURL;
  const other = await browser.newContext({ baseURL });
  const otherPage = await other.newPage();
  try {
    await otherPage.goto("/login");
    await otherPage.getByLabel("Email").fill(PRIMARY_DEMO.email);
    await otherPage.getByLabel("Password").fill(DEMO_PASSWORD);
    await otherPage.getByRole("button", { name: "Sign in" }).click();
    await expect(otherPage).toHaveURL(/\/p\/ORB/);

    await page.goto("/forgot-password");
    await expect(page.getByTestId("reset-unavailable")).toHaveCount(0);
    await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("reset-requested")).toHaveText(
      "If an account exists for that email, a reset link is ready. It expires in 30 minutes and works once.",
    );
    const link = resetLink();
    const before = readFileSync(outbox, "utf8").split("\n").filter((line) => line.length > 0).length;

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("reset-requested")).toHaveText(
      "If an account exists for that email, a reset link is ready. It expires in 30 minutes and works once.",
    );
    expect(readFileSync(outbox, "utf8").split("\n").filter((line) => line.length > 0)).toHaveLength(before);

    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/p\/ORB/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login/);

    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill("reset-password-789");
    await page.getByLabel("Confirm new password").fill("reset-password-789");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();

    await page.goto("/p/ORB");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await other.close();
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(PRIMARY_DEMO.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await page.getByLabel("Password").fill(next);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/p\/ORB/);
});
