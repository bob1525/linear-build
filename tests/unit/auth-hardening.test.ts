import { describe, expect, it } from "vitest";
import { showDemoCredentials } from "@/lib/demo-hint";
import {
  AUTH_WINDOW_MS,
  LOGIN_FAILURE_LIMIT,
  RATE_LIMIT_MESSAGE,
  SIGNUP_EMAIL_LIMIT,
  consumeIfAllowed,
  createRateLimiter,
  readClientAddress,
} from "@/lib/rate-limit";

describe("showDemoCredentials", () => {
  it("shows the hint in development and hides it in production", () => {
    expect(showDemoCredentials({ NODE_ENV: "development" })).toBe(true);
    expect(showDemoCredentials({ NODE_ENV: "test" })).toBe(true);
    expect(showDemoCredentials({ NODE_ENV: "production" })).toBe(false);
    expect(showDemoCredentials({})).toBe(true);
  });

  it("lets an explicit flag override the environment", () => {
    expect(showDemoCredentials({ NODE_ENV: "production", NORTHSTAR_SHOW_DEMO: "1" })).toBe(true);
    expect(showDemoCredentials({ NODE_ENV: "development", NORTHSTAR_SHOW_DEMO: "0" })).toBe(false);
  });
});

describe("readClientAddress", () => {
  it("uses the first forwarded address, then x-real-ip, then local", () => {
    expect(readClientAddress((name) => (name === "x-forwarded-for" ? "203.0.113.4, 10.0.0.1" : null))).toBe(
      "203.0.113.4",
    );
    expect(readClientAddress((name) => (name === "x-real-ip" ? "198.51.100.8" : null))).toBe("198.51.100.8");
    expect(readClientAddress(() => null)).toBe("local");
  });
});

describe("rate limiter", () => {
  it("allows the configured number of hits and then blocks until the window passes", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.check("ava", 0)).toEqual({ allowed: true });
    limiter.hit("ava", 0);
    limiter.hit("ava", 100);
    expect(limiter.check("ava", 500)).toEqual({ allowed: false, retryAfterMs: 500 });
    expect(limiter.check("ava", 1_000)).toEqual({ allowed: true });
    expect(limiter.check("other", 500)).toEqual({ allowed: true });
  });

  it("does not record either key when one of them is already full", () => {
    const email = createRateLimiter({ limit: SIGNUP_EMAIL_LIMIT, windowMs: AUTH_WINDOW_MS });
    const address = createRateLimiter({ limit: 1, windowMs: AUTH_WINDOW_MS });
    expect(consumeIfAllowed([{ limiter: address, key: "local" }], 0)).toBeNull();
    const blocked = consumeIfAllowed(
      [
        { limiter: email, key: "ada@example.com" },
        { limiter: address, key: "local" },
      ],
      10,
    );
    expect(blocked).toBe(RATE_LIMIT_MESSAGE);
    expect(email.check("ada@example.com", 10)).toEqual({ allowed: true });
  });

  it("matches the sign-in failure budget", () => {
    const limiter = createRateLimiter({ limit: LOGIN_FAILURE_LIMIT, windowMs: AUTH_WINDOW_MS });
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) limiter.hit("ava@northstar.dev", attempt);
    expect(limiter.check("ava@northstar.dev", LOGIN_FAILURE_LIMIT).allowed).toBe(false);
  });
});
