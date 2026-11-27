import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadDatabaseUrl } from "./load-env";

const INIT_MIGRATION = "20261127100000_init";
const RATE_LIMIT_MIGRATION = "20261127100100_rate_limit_event";

const BASELINE_TABLES = [
  "User",
  "Session",
  "Project",
  "ProjectMember",
  "Label",
  "Issue",
  "IssueRelation",
  "SavedView",
  "IssueLabel",
  "Comment",
  "Activity",
];

function runPrisma(args: string[]) {
  try {
    const output = execFileSync("npx", ["prisma", ...args], {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true as const, output, status: 0 };
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; status?: number | null };
    return {
      ok: false as const,
      output: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
      status: failed.status ?? 1,
    };
  }
}

async function tableNames() {
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    return new Set(rows.map((row) => row.name));
  } finally {
    await db.$disconnect();
  }
}

function sqliteUrlForDiff(url: string) {
  if (!url.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  if (filePath.startsWith("/")) return url;
  // migrate deploy resolves a relative SQLite path from prisma/. migrate diff resolves it from the project root.
  return `file:${path.resolve("prisma", filePath)}`;
}

function assertNoDrift() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const diff = runPrisma([
    "migrate",
    "diff",
    "--from-url",
    sqliteUrlForDiff(url),
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
  ]);
  if (diff.ok) return;
  if (diff.status === 2) {
    process.stderr.write(diff.output);
    process.stderr.write("The database does not match prisma/schema.prisma after migrations.\n");
    process.exit(1);
  }
  process.stderr.write(diff.output);
  process.exit(diff.status);
}

async function baselineExistingDatabase(deployOutput: string) {
  const tables = await tableNames();
  const missing = BASELINE_TABLES.filter((name) => !tables.has(name));
  if (missing.length > 0) {
    process.stderr.write(deployOutput);
    process.stderr.write(
      `This SQLite file is not empty and has no migration history, but it is missing ${missing.join(", ")}. It was not baselined.\n`,
    );
    process.exit(1);
  }

  console.log(`Baselined ${INIT_MIGRATION} because this file already has the Northstar tables.`);
  const init = runPrisma(["migrate", "resolve", "--applied", INIT_MIGRATION]);
  if (!init.ok) {
    process.stderr.write(init.output);
    process.exit(init.status);
  }
  process.stdout.write(init.output);

  if (tables.has("RateLimitEvent")) {
    console.log(`Marked ${RATE_LIMIT_MIGRATION} applied because RateLimitEvent is already present.`);
    const rate = runPrisma(["migrate", "resolve", "--applied", RATE_LIMIT_MIGRATION]);
    if (!rate.ok) {
      process.stderr.write(rate.output);
      process.exit(rate.status);
    }
    process.stdout.write(rate.output);
  }

  const deployed = runPrisma(["migrate", "deploy"]);
  if (!deployed.ok) {
    process.stderr.write(deployed.output);
    process.exit(deployed.status);
  }
  process.stdout.write(deployed.output);
}

async function main() {
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and try again.");
  }

  const deployed = runPrisma(["migrate", "deploy"]);
  if (deployed.ok) {
    process.stdout.write(deployed.output);
  } else if (deployed.output.includes("P3005")) {
    await baselineExistingDatabase(deployed.output);
  } else {
    process.stderr.write(deployed.output);
    process.exit(deployed.status);
  }

  assertNoDrift();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
