import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/create-prisma";
import { recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit-store";

const root = path.resolve(__dirname, "../..");

function read(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

function modelText(source: string) {
  const start = source.indexOf("model ");
  return source.slice(start).replace(/\r\n/g, "\n").trim();
}

const exec = promisify(execFile);

function runSync(args: string[], url: string) {
  return execFileSync("npx", args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function run(args: string[], url: string) {
  const result = await exec("npx", args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  return result.stdout;
}

describe("postgres path", () => {
  it("keeps the sqlite schema and the postgres schema on the same models", () => {
    expect(modelText(read("prisma/postgres/schema.prisma"))).toBe(modelText(read("prisma/schema.prisma")));
    expect(read("prisma/migrations/migration_lock.toml")).toContain('provider = "sqlite"');
    expect(read("prisma/postgres/migrations/migration_lock.toml")).toContain('provider = "postgresql"');
    expect(read("prisma/migrations/20261127100000_init/migration.sql")).toContain("DATETIME");
    const postgresSql = read("prisma/postgres/migrations/20261127120000_init/migration.sql");
    expect(postgresSql).toContain("TIMESTAMP(3)");
    expect(postgresSql).not.toContain("DATETIME");
    expect(postgresSql).toContain('CREATE TABLE "RateLimitEvent"');
  });

  it("refuses a sqlite URL and leaves that file on the sqlite migrate command", () => {
    let failed: { stdout?: string; stderr?: string; message?: string } | undefined;
    try {
      runSync(["tsx", "scripts/apply-postgres-migrations.ts"], "file:./dev.db");
    } catch (error) {
      failed = error as { stdout?: string; stderr?: string; message?: string };
    }
    const text = `${failed?.stdout ?? ""}${failed?.stderr ?? ""}${failed?.message ?? ""}`;
    expect(text).toContain("db:migrate:pg needs DATABASE_URL");
    expect(text).not.toContain("successfully applied");
  });

  it("applies the postgres history, seeds, and counts a sign-in on that database", async () => {
    const database = await PGlite.create();
    const server = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
      maxConnections: 10,
    });
    await server.start();
    // PGlite serves every connection from one session, so a later Prisma
    // client would reuse the previous client's prepared statement name.
    // pgbouncer=true makes Prisma skip named statements. A real Postgres
    // server does not need that flag.
    const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
    let prisma: ReturnType<typeof createPrismaClient> | undefined;
    try {
      const first = await run(["tsx", "scripts/apply-postgres-migrations.ts"], url);
      expect(first).toContain("20261127120000_init");
      expect(first).toContain("20261127130000_password_reset");
      expect(first).toContain("All migrations have been successfully applied.");
      const second = await run(["tsx", "scripts/apply-postgres-migrations.ts"], url);
      expect(second).toContain("No pending migrations to apply.");
      await run(["tsx", "prisma/seed.ts"], url);

      prisma = createPrismaClient(url);
      const ava = await prisma.user.findUnique({ where: { email: "ava@northstar.dev" } });
      expect(ava?.name).toBe("Ava Chen");
      expect(await prisma.issue.count()).toBeGreaterThan(10);
      const recorded = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
        "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name",
      );
      expect(recorded.map((row) => row.migration_name)).toEqual([
        "20261127120000_init",
        "20261127130000_password_reset",
      ]);

      const now = Date.now();
      for (let attempt = 0; attempt < 8; attempt += 1) {
        expect(await recordLoginFailure(prisma, "ava@northstar.dev", "203.0.113.10", now + attempt)).toBe(true);
      }
      expect(await recordLoginFailure(prisma, "ava@northstar.dev", "203.0.113.10", now + 8)).toBe(false);
      expect(await prisma.rateLimitEvent.count({ where: { bucket: "login-email", key: "ava@northstar.dev" } })).toBe(8);
      expect(await recordLoginSuccess(prisma, "ava@northstar.dev", "203.0.113.10", now)).toBe(true);
      expect(await prisma.rateLimitEvent.count({ where: { bucket: "login-success-email" } })).toBe(1);
    } finally {
      await prisma?.$disconnect();
      await server.stop();
      await database.close();
    }
  }, 90_000);
});
