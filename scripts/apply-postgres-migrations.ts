import { execFileSync } from "node:child_process";
import { loadDatabaseUrl } from "./load-env";

const SCHEMA = "prisma/postgres/schema.prisma";

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

function assertPostgresUrl(url: string | undefined): asserts url is string {
  if (url?.startsWith("postgresql://") || url?.startsWith("postgres://")) return;
  console.error(
    "db:migrate:pg needs DATABASE_URL to start with postgresql:// or postgres://. SQLite stays on npm run db:migrate.",
  );
  process.exit(1);
}

function assertNoDrift(url: string) {
  const diff = runPrisma([
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    SCHEMA,
    "--exit-code",
  ]);
  if (diff.ok) return;
  process.stderr.write(diff.output);
  process.exit(diff.status);
}

function main() {
  loadDatabaseUrl();
  assertPostgresUrl(process.env.DATABASE_URL);
  const deployed = runPrisma(["migrate", "deploy", "--schema", SCHEMA]);
  if (!deployed.ok) {
    process.stderr.write(deployed.output);
    process.exit(deployed.status);
  }
  process.stdout.write(deployed.output);
  assertNoDrift(process.env.DATABASE_URL);
}

main();
