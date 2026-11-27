import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_WINDOW_MS, LOGIN_FAILURE_IP_LIMIT, LOGIN_FAILURE_LIMIT, LOGIN_SUCCESS_EMAIL_LIMIT, LOGIN_SUCCESS_IP_LIMIT, RATE_LIMIT_MESSAGE, SIGNUP_EMAIL_LIMIT, SIGNUP_IP_LIMIT } from "@/lib/rate-limit";
import {
  LOGIN_EMAIL_BUCKET,
  LOGIN_SUCCESS_ADDRESS_BUCKET,
  LOGIN_SUCCESS_EMAIL_BUCKET,
  PASSWORD_ADDRESS_BUCKET,
  PASSWORD_EMAIL_BUCKET,
  SIGNUP_EMAIL_BUCKET,
  checkRateLimit,
  consumeSignup,
  hitRateLimit,
  loginIsLimited,
  passwordChangeIsLimited,
  recordLoginFailure,
  recordLoginSuccess,
  recordPasswordFailure,
} from "@/lib/rate-limit-store";

let directory = "";
let databaseUrl = "";
let db: PrismaClient;

beforeAll(() => {
  directory = mkdtempSync(path.join(tmpdir(), "northstar-limits-"));
  const file = path.join(directory, "limits.db");
  databaseUrl = `file:${file}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
});

beforeEach(async () => {
  await db.rateLimitEvent.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("persisted auth rate limits", () => {
  it("drops hits once the window has passed", async () => {
    await hitRateLimit(db, { bucket: "window", key: "ada", windowMs: 1_000, now: 0 });
    await hitRateLimit(db, { bucket: "window", key: "ada", windowMs: 1_000, now: 100 });
    expect(await checkRateLimit(db, { bucket: "window", key: "ada", limit: 2, windowMs: 1_000, now: 500 })).toEqual({
      allowed: false,
      retryAfterMs: 500,
    });
    expect(await checkRateLimit(db, { bucket: "window", key: "ada", limit: 2, windowMs: 1_000, now: 1_000 })).toEqual({
      allowed: true,
    });
    expect(await checkRateLimit(db, { bucket: "window", key: "other", limit: 2, windowMs: 1_000, now: 500 })).toEqual({
      allowed: true,
    });
  });

  it("keeps sign-in failures until a new client opens the same file", async () => {
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      await recordLoginFailure(db, "ada@example.com", "local", 5_000 + attempt);
    }
    expect(await loginIsLimited(db, "ada@example.com", "local", 5_100)).toBe(true);
    expect(await loginIsLimited(db, "other@example.com", "local", 5_100)).toBe(false);

    await db.$disconnect();
    const restarted = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      expect(await loginIsLimited(restarted, "ada@example.com", "local", 5_100)).toBe(true);
      expect(await restarted.rateLimitEvent.count({ where: { bucket: LOGIN_EMAIL_BUCKET, key: "ada@example.com" } })).toBe(
        LOGIN_FAILURE_LIMIT,
      );
    } finally {
      await restarted.$disconnect();
      db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    }
  });

  it("counts a hit written by another process on the same file", () => {
    const probe = path.join(directory, "probe.cjs");
    writeFileSync(
      probe,
      `const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: process.argv[2] } } });
prisma.rateLimitEvent
  .create({ data: { bucket: process.argv[3], key: process.argv[4], at: new Date(Number(process.argv[5])) } })
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
`,
    );
    const root = path.resolve(__dirname, "../..");
    execFileSync(process.execPath, [probe, databaseUrl, LOGIN_EMAIL_BUCKET, "shared@example.com", "50"], {
      cwd: root,
      env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
      stdio: "pipe",
    });
    return checkRateLimit(db, {
      bucket: LOGIN_EMAIL_BUCKET,
      key: "shared@example.com",
      limit: 1,
      windowMs: AUTH_WINDOW_MS,
      now: 60,
    }).then((decision) => {
      expect(decision.allowed).toBe(false);
    });
  });

  it("stops counting a signup email at the limit and still records a different email", async () => {
    for (let attempt = 0; attempt < SIGNUP_EMAIL_LIMIT; attempt += 1) {
      expect(await consumeSignup(db, "ada@example.com", "local", 10_000 + attempt)).toBeNull();
    }
    expect(await consumeSignup(db, "ada@example.com", "local", 10_100)).toBe(RATE_LIMIT_MESSAGE);
    expect(await db.rateLimitEvent.count({ where: { bucket: "signup-email", key: "ada@example.com" } })).toBe(
      SIGNUP_EMAIL_LIMIT,
    );
    expect(await consumeSignup(db, "bea@example.com", "local", 10_200)).toBeNull();
  });

  it("does not record a new email when the address bucket is already full", async () => {
    for (let attempt = 0; attempt < SIGNUP_IP_LIMIT; attempt += 1) {
      expect(await consumeSignup(db, `person.${attempt}@example.com`, "local", 20_000 + attempt)).toBeNull();
    }
    expect(await consumeSignup(db, "overflow@example.com", "local", 21_000)).toBe(RATE_LIMIT_MESSAGE);
    expect(await db.rateLimitEvent.count({ where: { bucket: "signup-email", key: "overflow@example.com" } })).toBe(0);
  });

  it("limits wrong current passwords like sign-in failures, in a separate bucket", async () => {
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      await recordPasswordFailure(db, "ada@example.com", "local", 30_000 + attempt);
    }
    expect(await passwordChangeIsLimited(db, "ada@example.com", "local", 30_100)).toBe(true);
    expect(await passwordChangeIsLimited(db, "bea@example.com", "local", 30_100)).toBe(false);
    expect(await loginIsLimited(db, "ada@example.com", "local", 30_100)).toBe(false);
    expect(await db.rateLimitEvent.count({ where: { bucket: PASSWORD_EMAIL_BUCKET, key: "ada@example.com" } })).toBe(
      LOGIN_FAILURE_LIMIT,
    );
  });

  it("stops a password change from a new email when the address bucket is full", async () => {
    for (let attempt = 0; attempt < LOGIN_FAILURE_IP_LIMIT; attempt += 1) {
      await recordPasswordFailure(db, `person.${attempt}@example.com`, "shared", 40_000 + attempt);
    }
    expect(await passwordChangeIsLimited(db, "fresh@example.com", "shared", 41_000)).toBe(true);
    expect(await passwordChangeIsLimited(db, "fresh@example.com", "other", 41_000)).toBe(false);
    expect(await recordPasswordFailure(db, "one-more@example.com", "shared", 42_000)).toBe(false);
    expect(await db.rateLimitEvent.count({ where: { bucket: PASSWORD_ADDRESS_BUCKET, key: "shared" } })).toBe(
      LOGIN_FAILURE_IP_LIMIT,
    );
  });

  it("does not record a failed sign-in past the email limit", async () => {
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      expect(await recordLoginFailure(db, "ninth@example.com", `ip-${attempt}`, 100_000 + attempt)).toBe(true);
    }
    expect(await recordLoginFailure(db, "ninth@example.com", "another", 101_000)).toBe(false);
    expect(await db.rateLimitEvent.count({ where: { bucket: LOGIN_EMAIL_BUCKET, key: "ninth@example.com" } })).toBe(
      LOGIN_FAILURE_LIMIT,
    );
  });

  it("counts successful sign-ins apart from failures and stops at the email limit", async () => {
    for (let attempt = 0; attempt < LOGIN_SUCCESS_EMAIL_LIMIT; attempt += 1) {
      expect(await recordLoginSuccess(db, "ada@example.com", `ip-${attempt}`, 60_000 + attempt)).toBe(true);
    }
    expect(await recordLoginSuccess(db, "ada@example.com", "fresh-ip", 70_000)).toBe(false);
    expect(
      await db.rateLimitEvent.count({ where: { bucket: LOGIN_SUCCESS_EMAIL_BUCKET, key: "ada@example.com" } }),
    ).toBe(LOGIN_SUCCESS_EMAIL_LIMIT);
    expect(await recordLoginSuccess(db, "bea@example.com", "fresh-ip", 70_100)).toBe(true);
    expect(await loginIsLimited(db, "ada@example.com", "fresh-ip", 70_100)).toBe(false);
    expect(await passwordChangeIsLimited(db, "ada@example.com", "fresh-ip", 70_100)).toBe(false);
  });

  it("stops successful sign-ins from one address without blocking another address", async () => {
    for (let attempt = 0; attempt < LOGIN_SUCCESS_IP_LIMIT; attempt += 1) {
      expect(await recordLoginSuccess(db, `person.${attempt}@example.com`, "shared", 80_000 + attempt)).toBe(true);
    }
    expect(await recordLoginSuccess(db, "overflow@example.com", "shared", 90_000)).toBe(false);
    expect(
      await db.rateLimitEvent.count({ where: { bucket: LOGIN_SUCCESS_EMAIL_BUCKET, key: "overflow@example.com" } }),
    ).toBe(0);
    expect(
      await db.rateLimitEvent.count({ where: { bucket: LOGIN_SUCCESS_ADDRESS_BUCKET, key: "shared" } }),
    ).toBe(LOGIN_SUCCESS_IP_LIMIT);
    expect(await recordLoginSuccess(db, "overflow@example.com", "other", 90_100)).toBe(true);
  });

  it("does not let two clients insert past the signup or failure limits", async () => {
    const other = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const signups = await Promise.all(
        Array.from({ length: SIGNUP_EMAIL_LIMIT + 6 }, (_, attempt) =>
          consumeSignup(attempt % 2 === 0 ? db : other, "burst@example.com", `signup-ip-${attempt}`, 110_000),
        ),
      );
      expect(signups.filter((result) => result === null)).toHaveLength(SIGNUP_EMAIL_LIMIT);
      expect(await db.rateLimitEvent.count({ where: { bucket: SIGNUP_EMAIL_BUCKET, key: "burst@example.com" } })).toBe(
        SIGNUP_EMAIL_LIMIT,
      );

      const failures = await Promise.all(
        Array.from({ length: LOGIN_FAILURE_LIMIT + 6 }, (_, attempt) =>
          recordLoginFailure(attempt % 2 === 0 ? db : other, "burst-fail@example.com", `fail-ip-${attempt}`, 120_000),
        ),
      );
      expect(failures.filter(Boolean)).toHaveLength(LOGIN_FAILURE_LIMIT);
      expect(
        await db.rateLimitEvent.count({ where: { bucket: LOGIN_EMAIL_BUCKET, key: "burst-fail@example.com" } }),
      ).toBe(LOGIN_FAILURE_LIMIT);

      const successes = await Promise.all(
        Array.from({ length: LOGIN_SUCCESS_EMAIL_LIMIT + 6 }, (_, attempt) =>
          recordLoginSuccess(attempt % 2 === 0 ? db : other, "burst-ok@example.com", `ok-ip-${attempt}`, 130_000),
        ),
      );
      expect(successes.filter(Boolean)).toHaveLength(LOGIN_SUCCESS_EMAIL_LIMIT);
      expect(
        await db.rateLimitEvent.count({ where: { bucket: LOGIN_SUCCESS_EMAIL_BUCKET, key: "burst-ok@example.com" } }),
      ).toBe(LOGIN_SUCCESS_EMAIL_LIMIT);
    } finally {
      await other.$disconnect();
    }
  });
});
