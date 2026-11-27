import { randomUUID } from "node:crypto";
import { Prisma as SqlitePrisma, type PrismaClient } from "@prisma/client";
import { Prisma as PostgresPrisma } from "@prisma-postgres/client";
import {
  AUTH_WINDOW_MS,
  LOGIN_FAILURE_IP_LIMIT,
  LOGIN_FAILURE_LIMIT,
  LOGIN_SUCCESS_EMAIL_LIMIT,
  LOGIN_SUCCESS_IP_LIMIT,
  RATE_LIMIT_MESSAGE,
  SIGNUP_EMAIL_LIMIT,
  SIGNUP_IP_LIMIT,
  type RateLimitDecision,
} from "@/lib/rate-limit";

export const LOGIN_EMAIL_BUCKET = "login-email";
export const LOGIN_ADDRESS_BUCKET = "login-address";
export const LOGIN_SUCCESS_EMAIL_BUCKET = "login-success-email";
export const LOGIN_SUCCESS_ADDRESS_BUCKET = "login-success-address";
export const SIGNUP_EMAIL_BUCKET = "signup-email";
export const SIGNUP_ADDRESS_BUCKET = "signup-address";
export const PASSWORD_EMAIL_BUCKET = "password-email";
export const PASSWORD_ADDRESS_BUCKET = "password-address";

type EventStore = Pick<PrismaClient, "rateLimitEvent"> | SqlitePrisma.TransactionClient;
type Store = PrismaClient;
type Slot = { bucket: string; key: string; limit: number };

export async function checkRateLimit(
  db: EventStore,
  input: { bucket: string; key: string; limit: number; windowMs: number; now?: number },
): Promise<RateLimitDecision> {
  const now = input.now ?? Date.now();
  await prune(db, input.bucket, input.key, input.windowMs, now);
  const rows = await db.rateLimitEvent.findMany({
    where: { bucket: input.bucket, key: input.key },
    orderBy: { at: "asc" },
    select: { at: true },
  });
  if (rows.length < input.limit) return { allowed: true };
  const oldest = rows[0]?.at.getTime() ?? now;
  return { allowed: false, retryAfterMs: Math.max(1, input.windowMs - (now - oldest)) };
}

export async function hitRateLimit(
  db: EventStore,
  input: { bucket: string; key: string; windowMs: number; now?: number },
) {
  const now = input.now ?? Date.now();
  await prune(db, input.bucket, input.key, input.windowMs, now);
  await db.rateLimitEvent.create({
    data: { bucket: input.bucket, key: input.key, at: new Date(now) },
  });
}

async function prune(db: EventStore, bucket: string, key: string, windowMs: number, now: number) {
  await db.rateLimitEvent.deleteMany({
    where: { bucket, key, at: { lte: new Date(now - windowMs) } },
  });
}

type SqlApi = Pick<typeof SqlitePrisma, "sql" | "join">;

function sqlFor(db: Store): SqlApi {
  // The generated client class does not satisfy instanceof. The instance
  // records the provider that will parameterize the statement.
  const provider = (db as { _activeProvider?: string })._activeProvider;
  return provider === "postgresql" ? PostgresPrisma : SqlitePrisma;
}

/**
 * Insert every slot, or none, in one statement. The database runs that
 * statement by itself, so a second caller counts the first call's rows
 * instead of passing the check before either insert lands. The derived
 * table is named because Postgres rejects an unnamed subquery. Fragments
 * come from the client that executes them. The other client's fragments
 * are bound as one value, and Postgres then rejects the statement.
 */
async function reserveSlots(db: Store, entries: Slot[], now: number): Promise<boolean> {
  const at = new Date(now);
  const cutoff = new Date(now - AUTH_WINDOW_MS);
  const sql = sqlFor(db);
  for (const entry of entries) {
    await db.$executeRaw`
      DELETE FROM "RateLimitEvent"
      WHERE "bucket" = ${entry.bucket} AND "key" = ${entry.key} AND "at" <= ${cutoff}
    `;
  }
  const rows = entries.map(
    (entry) => sql.sql`SELECT ${randomUUID()} AS id, ${entry.bucket} AS bucket, ${entry.key} AS key, ${at} AS at`,
  );
  const guards = entries.map(
    (entry) => sql.sql`(
      SELECT COUNT(*) FROM "RateLimitEvent"
      WHERE "bucket" = ${entry.bucket} AND "key" = ${entry.key} AND "at" > ${cutoff}
    ) < ${entry.limit}`,
  );
  const inserted = await db.$executeRaw`
    INSERT INTO "RateLimitEvent" ("id", "bucket", "key", "at")
    SELECT id, bucket, key, at FROM (
      ${sql.join(rows, " UNION ALL ")}
    ) AS "slots"
    WHERE ${sql.join(guards, " AND ")}
  `;
  return inserted === entries.length;
}

export async function loginIsLimited(db: EventStore, email: string, address: string, now = Date.now()) {
  const emailDecision = await checkRateLimit(db, {
    bucket: LOGIN_EMAIL_BUCKET,
    key: email,
    limit: LOGIN_FAILURE_LIMIT,
    windowMs: AUTH_WINDOW_MS,
    now,
  });
  const addressDecision = await checkRateLimit(db, {
    bucket: LOGIN_ADDRESS_BUCKET,
    key: address,
    limit: LOGIN_FAILURE_IP_LIMIT,
    windowMs: AUTH_WINDOW_MS,
    now,
  });
  return !emailDecision.allowed || !addressDecision.allowed;
}

export async function recordLoginFailure(db: Store, email: string, address: string, now = Date.now()) {
  return reserveSlots(db, [
    { bucket: LOGIN_EMAIL_BUCKET, key: email, limit: LOGIN_FAILURE_LIMIT },
    { bucket: LOGIN_ADDRESS_BUCKET, key: address, limit: LOGIN_FAILURE_IP_LIMIT },
  ], now);
}

export async function recordLoginSuccess(db: Store, email: string, address: string, now = Date.now()) {
  return reserveSlots(db, [
    { bucket: LOGIN_SUCCESS_EMAIL_BUCKET, key: email, limit: LOGIN_SUCCESS_EMAIL_LIMIT },
    { bucket: LOGIN_SUCCESS_ADDRESS_BUCKET, key: address, limit: LOGIN_SUCCESS_IP_LIMIT },
  ], now);
}

export async function passwordChangeIsLimited(db: EventStore, email: string, address: string, now = Date.now()) {
  const emailDecision = await checkRateLimit(db, {
    bucket: PASSWORD_EMAIL_BUCKET,
    key: email,
    limit: LOGIN_FAILURE_LIMIT,
    windowMs: AUTH_WINDOW_MS,
    now,
  });
  const addressDecision = await checkRateLimit(db, {
    bucket: PASSWORD_ADDRESS_BUCKET,
    key: address,
    limit: LOGIN_FAILURE_IP_LIMIT,
    windowMs: AUTH_WINDOW_MS,
    now,
  });
  return !emailDecision.allowed || !addressDecision.allowed;
}

export async function recordPasswordFailure(db: Store, email: string, address: string, now = Date.now()) {
  return reserveSlots(db, [
    { bucket: PASSWORD_EMAIL_BUCKET, key: email, limit: LOGIN_FAILURE_LIMIT },
    { bucket: PASSWORD_ADDRESS_BUCKET, key: address, limit: LOGIN_FAILURE_IP_LIMIT },
  ], now);
}

export async function consumeSignup(db: Store, email: string, address: string, now = Date.now()): Promise<string | null> {
  const reserved = await reserveSlots(db, [
    { bucket: SIGNUP_EMAIL_BUCKET, key: email, limit: SIGNUP_EMAIL_LIMIT },
    { bucket: SIGNUP_ADDRESS_BUCKET, key: address, limit: SIGNUP_IP_LIMIT },
  ], now);
  return reserved ? null : RATE_LIMIT_MESSAGE;
}
