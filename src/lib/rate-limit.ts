export const RATE_LIMIT_MESSAGE = "Too many attempts. Try again in a few minutes.";

export const LOGIN_FAILURE_LIMIT = 8;
export const LOGIN_FAILURE_IP_LIMIT = 40;
export const SIGNUP_EMAIL_LIMIT = 5;
export const SIGNUP_IP_LIMIT = 30;
export const AUTH_WINDOW_MS = 15 * 60 * 1000;

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

type Clock = { limit: number; windowMs: number };

export function createRateLimiter(options: Clock) {
  const hits = new Map<string, number[]>();

  function prune(key: string, now: number) {
    const kept = (hits.get(key) ?? []).filter((stamp) => now - stamp < options.windowMs);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
    return kept;
  }

  return {
    check(key: string, now = Date.now()): RateLimitDecision {
      const kept = prune(key, now);
      if (kept.length < options.limit) return { allowed: true };
      const oldest = kept[0] ?? now;
      return { allowed: false, retryAfterMs: Math.max(1, options.windowMs - (now - oldest)) };
    },
    hit(key: string, now = Date.now()) {
      const kept = prune(key, now);
      kept.push(now);
      hits.set(key, kept);
    },
    reset() {
      hits.clear();
    },
  };
}

export const loginFailuresByEmail = createRateLimiter({ limit: LOGIN_FAILURE_LIMIT, windowMs: AUTH_WINDOW_MS });
export const loginFailuresByAddress = createRateLimiter({
  limit: LOGIN_FAILURE_IP_LIMIT,
  windowMs: AUTH_WINDOW_MS,
});
export const signupsByEmail = createRateLimiter({ limit: SIGNUP_EMAIL_LIMIT, windowMs: AUTH_WINDOW_MS });
export const signupsByAddress = createRateLimiter({ limit: SIGNUP_IP_LIMIT, windowMs: AUTH_WINDOW_MS });

export function resetAuthRateLimits() {
  loginFailuresByEmail.reset();
  loginFailuresByAddress.reset();
  signupsByEmail.reset();
  signupsByAddress.reset();
}

export function readClientAddress(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);
  const real = get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "local";
}

export function consumeIfAllowed(
  limiters: { limiter: ReturnType<typeof createRateLimiter>; key: string }[],
  now = Date.now(),
): string | null {
  const decisions = limiters.map((entry) => entry.limiter.check(entry.key, now));
  if (decisions.some((decision) => !decision.allowed)) return RATE_LIMIT_MESSAGE;
  for (const entry of limiters) entry.limiter.hit(entry.key, now);
  return null;
}
