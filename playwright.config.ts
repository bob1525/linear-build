import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run start:e2e",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: "file:./e2e.db",
        NORTHSTAR_SHOW_DEMO: "1",
      },
    },
    {
      command: "npm run start:e2e:mail",
      url: "http://127.0.0.1:3101/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: "file:./e2e-mail.db",
        NORTHSTAR_SHOW_DEMO: "1",
        MAIL_TRANSPORT: "outbox",
        MAIL_E2E_OUTBOX: "1",
        MAIL_OUTBOX: ".mail/e2e-outbox.jsonl",
        MAIL_FROM: "Northstar <northstar@localhost>",
      },
    },
  ],
  projects: [
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "chromium",
      testIgnore: [/mobile\.spec\.ts/, /password-reset-mail\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mail",
      testMatch: /password-reset-mail\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3101" },
    },
  ],
});
