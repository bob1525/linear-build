import { expect, test } from "@playwright/test";

test("forgot password says reset email is unavailable when mail is off", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByTestId("reset-unavailable")).toHaveText(
    "Password reset email is unavailable until mail delivery is configured.",
  );
  await expect(page.getByRole("button", { name: "Send reset link" })).toHaveCount(0);
  await page.goto("/reset-password");
  await expect(page.getByTestId("reset-invalid")).toHaveText("This reset link is invalid or has expired.");
});
