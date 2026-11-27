# Auth rate limits

The sign-in and registration counters used to live in a `Map` in one Node process. A restart cleared them, and a second process did not see them. The client address was taken from `x-forwarded-for` or `x-real-ip` on every request, so a caller could pick their own bucket.

## What was done

Failed sign-ins and accepted registrations are rows in `RateLimitEvent` in the SQLite file from `DATABASE_URL`. The buckets are `login-email`, `login-address`, `signup-email`, and `signup-address`. Old rows for that bucket and key are deleted once they are outside the 15 minute window. The limits are unchanged: 8 failed sign-ins per email, 40 per address, 5 registrations per email, 30 per address. A successful sign-in still does not count. An invalid registration form still does not count.

Any process that opens that same file sees the rows. Closing the client and opening a new one still sees them, which is what a process restart does. `npm run db:setup` deletes the rows before it reseeds, so a fresh demo database does not keep a previous lockout.

`readClientAddress` returns `local` unless `TRUST_PROXY` is exactly `1`. `0`, `true`, and an unset variable all ignore `x-forwarded-for` and `x-real-ip`. When the flag is `1`, the address is still the first forwarded hop, then `x-real-ip`, then `local`, and a forwarded value is cut at 80 characters. Login and signup call that function with `process.env`.

The pure in-memory `createRateLimiter` is still there. The unit tests that describe the window use it. Login and signup do not.

`README.md` documents `TRUST_PROXY` and the SQLite rows. `.env.example` leaves the flag commented out. This stage does not add email verification or password reset. It does not add a migration history; `prisma db push` creates the table. An existing file needs that push before login or signup, or the query throws.

## Verification

2026-11-27, Node v22.23.4, on `cursor/linear-issue-tracker-ef1d`.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **83/83** (11 files) |
| `npm run test:e2e` | **46 passed** (1.2 minutes). The keyboard test passed on the first attempt (402 ms). No flaky test |

`tests/unit/auth-hardening.test.ts` still has the forwarded-address case. It now passes `{ TRUST_PROXY: "1" }` so those three results stay `203.0.113.4`, `198.51.100.8`, and `local`. A new test checks that the same headers are `local` when the flag is missing, `0`, or `true`.

`tests/unit/auth-limits.test.ts` adds 5 tests against a temporary SQLite file created with `prisma db push`:

- Two hits inside a 1 second window block, and the hit at time 0 is gone at 1000 ms (`retryAfterMs` 500 at 500 ms).
- Eight failed sign-ins for one email still block after `PrismaClient` is disconnected and a new client opens the same file. A different email is not blocked.
- A second Node process inserts one `login-email` row into that file. The parent then sees the key as limited.
- The sixth signup for one email returns `Too many attempts. Try again in a few minutes.` and the email still has 5 rows. A different email is accepted.
- After 30 signups from `local`, one more email is rejected and that email has 0 rows.

The existing end-to-end tests `blocks a run of bad passwords for one email` and `blocks repeated registration of one email` passed without edits. No test was deleted. Playwright `retries` was not changed.

## Problems found

The first draft of `readClientAddress` took `process.env` as a `{ TRUST_PROXY?: string }` default. TypeScript rejected that because `ProcessEnv` in this project requires `NODE_ENV` and the target type is a weak type. The default is now `{ TRUST_PROXY: process.env.TRUST_PROXY }`, and callers can still pass a small object.

The cross-process test writes its script under `/tmp`. Node resolves modules from that path, so the spawn sets `NODE_PATH` to this repo's `node_modules`. The first run failed with `Cannot find module '@prisma/client'` until that was set. The product path was not involved.

## Remaining limitations

- There is still no email verification and no password reset. The seeded password is still `demo1234`.
- Successful sign-ins are not limited. Eight failed passwords per email still run bcrypt before the next attempt is rejected.
- With `TRUST_PROXY` unset, every caller shares `local`. That is the safe default, and it is a coarse bucket. Set `TRUST_PROXY=1` only when the proxy replaces the forwarded headers. If it forwards the client’s own header, the client can still choose an address.
- Two requests can both pass the check before either insert, so a parallel burst can go past the limit by the number of requests already in flight.
- The rows are in this SQLite file only. Another file, or a serverless instance with its own disk, does not share them. Two processes can read the same file, and SQLite is still one writer: overlapping writes can hit a lock. This does not make a multi-instance deploy safe.
- Schema changes are still `prisma db push`. There is no migration history yet.

## Actions run

Push of `cb3bd03`: [45978699980](https://github.com/bob1525/linear-build/actions/runs/45978699980), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:02:28Z to 10:03:01Z. **83 passed**.
- `Playwright`: 2026-11-27 10:02:29Z to 10:04:45Z. **46 passed** (1.3 minutes). No flaky test. The keyboard test passed on the first attempt (449 ms).

Pull request of the same commit: [45978709977](https://github.com/bob1525/linear-build/actions/runs/45978709977), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:02:33Z to 10:03:05Z. **83 passed**.
- `Playwright`: 2026-11-27 10:02:33Z to 10:05:06Z. **46 passed** (1.3 minutes). No flaky test. The keyboard test passed on the first attempt (481 ms).
