import type { PrismaClient } from "@prisma/client";
import {
  AUTH_WINDOW_MS,
  LOGIN_FAILURE_IP_LIMIT,
  LOGIN_FAILURE_LIMIT,
  RATE_LIMIT_MESSAGE,
  SIGNUP_EMAIL_LIMIT,
  SIGNUP_IP_LIMIT,
  type RateLimitDecision,
} from "@/lib/rate-limit";

export const LOGIN_EMAIL_BUCKET = "login-email";
export const LOGIN_ADDRESS_BUCKET = "login-address";
export const SIGNUP_EMAIL_BUCKET = "signup-email";
export const SIGNUP_ADDRESS_BUCKET = "signup-address";
export const PASSWORD_EMAIL_BUCKET = "password-email";
export const PASSWORD_ADDRESS_BUCKET = "password-address";

type EventStore = Pick<PrismaClient, "rateLimitEvent">;
type Store = PrismaClient;

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
  await db.$transaction(async (tx) => {
    await hitRateLimit(tx, { bucket: LOGIN_EMAIL_BUCKET, key: email, windowMs: AUTH_WINDOW_MS, now });
    await hitRateLimit(tx, { bucket: LOGIN_ADDRESS_BUCKET, key: address, windowMs: AUTH_WINDOW_MS, now });
  });
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
  await db.$transaction(async (tx) => {
    await hitRateLimit(tx, { bucket: PASSWORD_EMAIL_BUCKET, key: email, windowMs: AUTH_WINDOW_MS, now });
    await hitRateLimit(tx, { bucket: PASSWORD_ADDRESS_BUCKET, key: address, windowMs: AUTH_WINDOW_MS, now });
  });
}

export async function consumeSignup(db: Store, email: string, address: string, now = Date.now()): Promise<string | null> {
  const entries = [
    { bucket: SIGNUP_EMAIL_BUCKET, key: email, limit: SIGNUP_EMAIL_LIMIT },
    { bucket: SIGNUP_ADDRESS_BUCKET, key: address, limit: SIGNUP_IP_LIMIT },
  ];
  for (const entry of entries) {
    const decision = await checkRateLimit(db, { ...entry, windowMs: AUTH_WINDOW_MS, now });
    if (!decision.allowed) return RATE_LIMIT_MESSAGE;
  }
  await db.$transaction(async (tx) => {
    for (const entry of entries) {
      await hitRateLimit(tx, { bucket: entry.bucket, key: entry.key, windowMs: AUTH_WINDOW_MS, now });
    }
  });
  return null;
}
