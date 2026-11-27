import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const initSql = path.join(root, "prisma/migrations/20261127100000_init/migration.sql");
const rateSql = path.join(root, "prisma/migrations/20261127100100_rate_limit_event/migration.sql");

function freshUrl() {
  const dir = mkdtempSync(path.join(tmpdir(), "northstar-migrate-"));
  return { dir, url: `file:${path.join(dir, "app.db")}` };
}

function apply(url: string) {
  return execFileSync("npx", ["tsx", "scripts/apply-migrations.ts"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

function executeSql(url: string, file: string) {
  execFileSync("npx", ["prisma", "db", "execute", "--file", file, "--url", url], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function recorded(url: string) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await db.$queryRawUnsafe<Array<{ migration_name: string }>>(
      "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name",
    );
    return {
      names: rows.map((row) => row.migration_name),
      events: await db.rateLimitEvent.count(),
    };
  } finally {
    await db.$disconnect();
  }
}

describe("versioned migrations", () => {
  it("creates the current schema on an empty file", async () => {
    const { url } = freshUrl();
    apply(url);
    apply(url);
    expect(await recorded(url)).toEqual({
      names: ["20261127100000_init", "20261127100100_rate_limit_event", "20261127100200_password_reset"],
      events: 0,
    });
  }, 30_000);

  it("adds RateLimitEvent to a database that already has the baseline tables", async () => {
    const { url } = freshUrl();
    executeSql(url, initSql);
    const output = apply(url);
    expect(output).toContain("Baselined 20261127100000_init");
    expect(await recorded(url)).toEqual({
      names: ["20261127100000_init", "20261127100100_rate_limit_event", "20261127100200_password_reset"],
      events: 0,
    });
  }, 30_000);

  it("baselines a database that already has RateLimitEvent and no migration history", async () => {
    const { url } = freshUrl();
    executeSql(url, initSql);
    executeSql(url, rateSql);
    const output = apply(url);
    expect(output).toContain("Marked 20261127100100_rate_limit_event applied");
    expect(await recorded(url)).toEqual({
      names: ["20261127100000_init", "20261127100100_rate_limit_event", "20261127100200_password_reset"],
      events: 0,
    });
  }, 30_000);

  it("does not baseline a file that is not a Northstar database", () => {
    const { dir, url } = freshUrl();
    const sql = path.join(dir, "other.sql");
    writeFileSync(sql, 'CREATE TABLE "Other" ("id" TEXT NOT NULL PRIMARY KEY);\n');
    executeSql(url, sql);
    expect(() => apply(url)).toThrow(/missing User/);
  }, 30_000);
});
