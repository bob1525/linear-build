import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readOutbox } from "@/lib/mail-outbox";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  RESET_INVALID,
  RESET_REQUEST_MESSAGE,
  RESET_TTL_MS,
  RESET_UNAVAILABLE,
  hashResetToken,
  requestPasswordReset,
  resetPassword,
} from "@/lib/password-reset";
import { RATE_LIMIT_MESSAGE, RESET_ADDRESS_LIMIT, RESET_EMAIL_LIMIT } from "@/lib/rate-limit";

let databaseUrl = "";
let db: PrismaClient;
let passwordHash = "";
const dirs: string[] = [];

function mailEnv(file: string) {
  return { NODE_ENV: "test", MAIL_OUTBOX: file, MAIL_FROM: "Northstar <mail@example.com>" };
}

async function box() {
  const dir = await mkdtemp(path.join(tmpdir(), "northstar-reset-"));
  dirs.push(dir);
  return path.join(dir, "outbox.jsonl");
}

async function request(email: string, file: string, address = "local", now = Date.now()) {
  return requestPasswordReset(db, {
    email,
    address,
    origin: "http://127.0.0.1:3101",
    env: mailEnv(file),
    now,
  });
}

function tokenFrom(text: string) {
  const link = text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("reset message has no link");
  return new URL(link).searchParams.get("token") ?? "";
}

beforeAll(async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "northstar-reset-db-"));
  databaseUrl = `file:${path.join(directory, "reset.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  passwordHash = await hashPassword("password123");
  await db.user.create({ data: { email: "ava@example.com", name: "Ava", passwordHash } });
});

beforeEach(async () => {
  await db.passwordResetToken.deleteMany();
  await db.session.deleteMany();
  await db.rateLimitEvent.deleteMany();
  await db.user.update({ where: { email: "ava@example.com" }, data: { passwordHash } });
});

afterAll(async () => {
  await db.$disconnect();
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("password reset", () => {
  it("uses the same reply for a known and an unknown email, and stores only a hash", async () => {
    const file = await box();
    const known = await request("Ava@Example.com", file);
    const unknown = await request("missing@example.com", file);
    expect(known).toEqual({ ok: true, message: RESET_REQUEST_MESSAGE });
    expect(unknown).toEqual(known);

    const stored = await readOutbox(file);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ to: "ava@example.com", subject: "Reset your Northstar password" });
    const token = tokenFrom(stored[0]?.text ?? "");
    const rows = await db.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashResetToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now() + RESET_TTL_MS - 5_000);
  });

  it("replaces the password once, signs out existing sessions, and ignores the old link", async () => {
    const file = await box();
    await request("ava@example.com", file, "local", 5_000);
    const token = tokenFrom((await readOutbox(file))[0]?.text ?? "");
    const user = await db.user.findUniqueOrThrow({ where: { email: "ava@example.com" } });
    await db.session.create({
      data: { token: "other-session", userId: user.id, expiresAt: new Date(RESET_TTL_MS) },
    });

    const mismatch = await resetPassword(db, {
      token,
      newPassword: "password456",
      confirmPassword: "password789",
      now: 5_000,
    });
    expect(mismatch).toMatchObject({ ok: false, error: "Passwords do not match" });
    expect(await db.session.count()).toBe(1);
    expect(await db.passwordResetToken.count()).toBe(1);

    const reset = await resetPassword(db, {
      token,
      newPassword: "password456",
      confirmPassword: "password456",
      now: 5_000,
    });
    expect(reset.ok).toBe(true);
    expect(await db.session.count()).toBe(0);
    expect(await db.passwordResetToken.count()).toBe(0);
    const updated = await db.user.findUniqueOrThrow({ where: { email: "ava@example.com" } });
    expect(await verifyPassword("password456", updated.passwordHash)).toBe(true);
    expect(await verifyPassword("password123", updated.passwordHash)).toBe(false);

    const again = await resetPassword(db, {
      token,
      newPassword: "password789",
      confirmPassword: "password789",
      now: 5_000,
    });
    expect(again).toEqual({ ok: false, error: RESET_INVALID });
    expect(await verifyPassword("password456", (await db.user.findUniqueOrThrow({ where: { email: "ava@example.com" } })).passwordHash)).toBe(
      true,
    );
  });

  it("expires the link and drops the previous link when a new one is requested", async () => {
    const file = await box();
    await request("ava@example.com", file, "local", 10_000);
    const first = tokenFrom((await readOutbox(file))[0]?.text ?? "");
    const expired = await resetPassword(db, {
      token: first,
      newPassword: "password456",
      confirmPassword: "password456",
      now: 10_000 + RESET_TTL_MS,
    });
    expect(expired).toEqual({ ok: false, error: RESET_INVALID });

    await request("ava@example.com", file, "local", 20_000);
    const messages = await readOutbox(file);
    const second = tokenFrom(messages[1]?.text ?? "");
    expect(
      await resetPassword(db, { token: first, newPassword: "password456", confirmPassword: "password456", now: 20_000 }),
    ).toEqual({ ok: false, error: RESET_INVALID });
    expect(
      (await resetPassword(db, { token: second, newPassword: "password456", confirmPassword: "password456", now: 20_000 })).ok,
    ).toBe(true);
  });

  it("limits requests per email and per address without saying whether the account exists", async () => {
    const file = await box();
    for (let attempt = 0; attempt < RESET_EMAIL_LIMIT; attempt += 1) {
      expect(await request("missing@example.com", file, "one", 30_000 + attempt)).toEqual({
        ok: true,
        message: RESET_REQUEST_MESSAGE,
      });
    }
    expect(await request("missing@example.com", file, "one", 31_000)).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
    expect(await request("ava@example.com", file, "somewhere-else", 31_000)).toEqual({ ok: true, message: RESET_REQUEST_MESSAGE });

    for (let attempt = 0; attempt < RESET_ADDRESS_LIMIT; attempt += 1) {
      expect((await request(`person${attempt}@example.com`, file, "shared", 40_000)).ok).toBe(true);
    }
    expect(await request("last@example.com", file, "shared", 41_000)).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
    expect(await readOutbox(file)).toHaveLength(1);
  });

  it("does not write a token or a message when mail is off", async () => {
    const file = await box();
    const env = { NODE_ENV: "production", MAIL_OUTBOX: file };
    const known = await requestPasswordReset(db, {
      email: "ava@example.com",
      address: "local",
      origin: "http://127.0.0.1:3100",
      env,
    });
    const unknown = await requestPasswordReset(db, {
      email: "missing@example.com",
      address: "local",
      origin: "http://127.0.0.1:3100",
      env,
    });
    expect(known).toEqual({ ok: false, error: RESET_UNAVAILABLE });
    expect(unknown).toEqual(known);
    expect(await db.passwordResetToken.count()).toBe(0);
    expect(await db.rateLimitEvent.count()).toBe(0);
    expect(await readOutbox(file)).toEqual([]);

    const allowed = await requestPasswordReset(db, {
      email: "ava@example.com",
      address: "local",
      origin: "http://127.0.0.1:3101",
      env: { NODE_ENV: "production", MAIL_TRANSPORT: "outbox", MAIL_E2E_OUTBOX: "1", MAIL_OUTBOX: file },
    });
    expect(allowed).toEqual({ ok: true, message: RESET_REQUEST_MESSAGE });
    expect(await readOutbox(file)).toHaveLength(1);
  });
});
