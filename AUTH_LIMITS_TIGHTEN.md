# Tighten auth limits

Successful sign-ins now count, and a parallel burst can no longer store more rate-limit rows than the limit. The failed-sign-in, registration, and password-change counters are unchanged. No mail provider was added.

[AUTH_LIMITS.md](AUTH_LIMITS.md) is the record of the earlier counters.

## What was done

`login-success-email` and `login-success-address` are new buckets on the existing `RateLimitEvent` table. A successful sign-in is recorded only after the password verifies, and only when the failed-sign-in pre-check passed. The caps for a 15 minute window are 120 per email and 400 per address. One `npm run test:e2e` recorded 50 successful sign-ins for `ava@northstar.dev` and 54 on the shared address `local` (50 for Ava, 2 for Marcus, 2 for the password-change account). 120 and 400 sit above that run, including a Playwright retry of a failed test, and above a person signing in through the day. A scripted loop still stops.

The failed-sign-in limits stay 8 per email and 40 per address. Registration stays 5 per email and 30 per address. A wrong current password stays 8 per email and 40 per address, in the password buckets, so it does not lock sign-in. A correct password change still does not consume a slot. An invalid signup form still does not count.

Those four writes go through one helper. It deletes expired rows for the buckets it is about to touch, then runs one `INSERT … SELECT … WHERE` that inserts every bucket row or none. The `WHERE` counts rows newer than the cutoff and requires each count to be under its limit. SQLite runs that statement by itself, so the next caller counts the rows the first caller stored. If the insert stores nothing, login and password change return `Too many attempts. Try again in a few minutes.` A full failure bucket still rejects the correct password before bcrypt, which is what the end-to-end lockout tests expect.

## How it was verified

2026-11-27, on `3f24747` plus this change. Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npm run typecheck` | Pass |
| `npm test` | **122 passed** (17 files). The previous suite was 118. Four tests were added, and the password-address test gained two assertions |
| `npm run test:e2e` | **58 passed** (1.5 minutes). No retry. The bad-password lockout, the repeated-registration lockout, and the wrong-current-password lockout passed on the first attempt |

`tests/unit/auth-limits.test.ts` now also checks:

- The ninth failed sign-in for one email returns false and leaves 8 `login-email` rows.
- 120 successful sign-ins for one email return true, and the next returns false with the row count still 120. A different email still succeeds. `loginIsLimited` and `passwordChangeIsLimited` stay false, so success rows do not lock failures or password changes.
- 400 successful sign-ins on one address stop the next email on that address, store no row for that email, and still allow the same email from another address.
- Two `PrismaClient`s racing the same file store exactly 5 signup rows, exactly 8 failure rows, and exactly 120 success rows. The extra calls return the rate-limit message or false.
- After 40 password failures on one address, the next `recordPasswordFailure` returns false and the address count stays 40.

After the end-to-end run, `prisma/e2e.db` had `login-success-email` 50 for Ava and `login-success-address` 54 for `local`. The failure rows were still 8 for the lockout email and 8 for the lockout password account. The repeated-registration email still had 5 signup rows.

## Problems found

The first write path counted and inserted inside a Prisma interactive transaction, after `PRAGMA busy_timeout = 5000` and a zero-row `DELETE` meant to take the SQLite reserved lock. `$executeRawUnsafe` rejected the pragma: SQLite returns a row for it (`Execute returned results, which is not allowed in SQLite`). `$queryRaw` accepted the pragma. Two clients then racing `consumeSignup` still failed with Prisma’s socket timeout (`the database failed to respond to a query within the configured timeout`) at about 10 seconds. That is the same timeout a race of the old check-then-insert hit in `prune` during `deleteMany`, before this change. Prisma’s interactive transaction starts deferred. The parallel connections each held one, and the write never finished before the engine gave up.

The shipped path does not use that transaction. A separate probe, deleted afterward and not committed, ran the single `INSERT … SELECT … WHERE` from two clients, 12 signups of one email. It stored 5 email rows and 5 address rows, returned 0 for the other 7 calls, and finished in 52 ms with no error. The unit test above now covers that race at the real signup, failure, and success limits.

## Remaining limitations

- There is still no email verification and no forgot-password flow. Those need a mail provider. This stage does not add one. The seeded password is still `demo1234`. `NORTHSTAR_SHOW_DEMO=1` still shows Fill demo.
- A request that already passed the failure pre-check can finish one bcrypt comparison. The insert then refuses an extra failure row. Taking the failure slot before bcrypt would consume it for a correct password and would change the lockout the end-to-end tests cover.
- The success row is stored before `createSession`. If creating the session throws, that slot is already used.
- Eight failures still reject the correct password for the rest of the window. That is the existing lockout.
- With `TRUST_PROXY` unset, every caller shares `local`. Set `TRUST_PROXY=1` only when the proxy replaces the forwarded headers. If it forwards the client’s own header, the client can still choose an address.
- The rows live in this SQLite file. Another file does not share them. The single insert serializes writers on one file. It does not make a multi-instance deploy safe.
- `npm run test:e2e` resets `prisma/e2e.db` before it builds. A third `playwright` run against that same file, without the reset, can pass 120 successful sign-ins for Ava (50 times 3). The in-memory `createRateLimiter` is still unused by login and signup.

## Actions run

Push of `a8585a2`: [46020029229](https://github.com/bob1525/linear-build/actions/runs/46020029229), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 14:53:58Z to 14:54:50Z. **122 passed** (17 files).
- `Playwright`: 2026-11-27 14:53:57Z to 14:56:51Z. **58 passed** (1.6 minutes). `blocks a run of bad passwords for one email` passed on the first attempt (1.0 seconds). `blocks repeated registration of one email` passed on the first attempt (1.9 seconds). `blocks a run of wrong current passwords for one account` passed on the first attempt (2.5 seconds). `the later saver of an issue gets a conflict prompt` passed on the first attempt (2.0 seconds). The keyboard test passed on the first attempt (2.2 seconds).

Pull request of the same commit: [46020039459](https://github.com/bob1525/linear-build/actions/runs/46020039459), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 14:54:01Z to 14:54:51Z. **122 passed** (17 files).
- `Playwright`: 2026-11-27 14:54:02Z to 14:57:09Z. **58 passed** (1.9 minutes). The bad-password lockout passed on the first attempt (1.3 seconds). The repeated-registration lockout passed on the first attempt (3.4 seconds). The wrong-current-password lockout passed on the first attempt (2.4 seconds). The conflict test passed on the first attempt (6.8 seconds). The keyboard test passed on the first attempt (2.5 seconds).

Performance on the same commit, not required: [46020039460](https://github.com/bob1525/linear-build/actions/runs/46020039460), conclusion success. Board-load median 422 ms, `status=ok`. List-load median 373 ms, 19 mounted at the top and 18 at the end.
