# Signed-in password change

A person who is already signed in can replace their password. There is no email, so there is no verification message and no forgot-password link. A wrong current password is limited the same way as a failed sign-in. No existing test was deleted or weakened.

## What was done

`/account` asks for the current password, a new password of 8 to 200 characters, and a confirmation. The sidebar links there. The empty welcome page is outside that sidebar, so it has its own link.

`changePasswordAction` requires the session. It checks the limit, then bcrypt-compares the current password. A mismatch records a failure and returns "Current password is incorrect". A match stores a new bcrypt hash (10 rounds) and deletes every other session for that user. The session that sent the form stays signed in.

The limit uses the sign-in numbers: 8 per email and 40 per address, in 15 minutes, and the same message, "Too many attempts. Try again in a few minutes." The rows are `password-email` and `password-address` in `RateLimitEvent`. They are not the sign-in rows, so a locked sign-in does not block this form, and a run of wrong current passwords does not block sign-in. A successful change does not consume a slot. The address still comes from `readClientAddress`, so it is `local` unless `TRUST_PROXY` is exactly `1`.

`README.md` describes the form, the separate buckets, and the two flows that still need a mail provider.

## Verification

2026-11-27, Node v22.23.4, 4 cores, 16003 MB.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npx tsc --noEmit` | Pass |
| `npm test` | **105/105** (15 files). One new schema test and two new rate-limit tests. The previous 102 still pass |
| `npm run test:e2e` | **52 passed** (1.5 minutes). Four new tests in `e2e/password.spec.ts`. The conflict test passed on the first attempt (5.8 seconds). The keyboard test passed on the first attempt (412 ms). No flaky test |

The new end-to-end tests, with `--retries=0` before the full run, passed 4: the password replacement and the other session ending (2.0 seconds), eight wrong current passwords then the limit (1.6 seconds), the Orbit account link, and a logged-out visit redirecting to sign-in.

## Problems found

The first end-to-end run never found "Change password" after signup. `/welcome` is not inside the app shell, so the sidebar link is not on that page. The empty workspace now links to `/account`. The shell link is unchanged, and the Orbit test clicks that one.

The next run saved the password and still showed the filled form, with no success message. `onSubmit` called `event.currentTarget.reset()` after the server action. React clears `currentTarget` once the handler waits, so `reset` threw and `setDone` never ran. The form element is captured before the wait. The assertion was not changed. The rerun is the table above.

## Remaining limitations

- There is no email verification and no forgot-password flow. Both need a mail provider. This stage does not invent one.
- The seeded password is still `demo1234`.
- A successful change is not limited. A wrong current password still runs bcrypt until the eighth failure for that email, the same as sign-in.
- The current session stays. Other sessions for that account are deleted.
- With `TRUST_PROXY` unset, every caller shares the `local` address bucket for this form. It is a different bucket from sign-in.

## Actions run

Push of `1913b03`: [46004443850](https://github.com/bob1525/linear-build/actions/runs/46004443850), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 13:07:51Z to 13:08:34Z. **105 passed**.
- `Playwright`: 2026-11-27 13:07:51Z to 13:10:36Z. **52 passed** (1.5 minutes). `the later saver of an issue gets a conflict prompt` passed on the first attempt (2.5 seconds). The keyboard test passed on the first attempt (552 ms). `a signed-in user replaces their password and other sessions end` passed on the first attempt (2.2 seconds). `blocks a run of wrong current passwords for one account` passed on the first attempt (2.1 seconds).

Pull request of the same commit: [46004455900](https://github.com/bob1525/linear-build/actions/runs/46004455900), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 13:07:57Z to 13:08:50Z. **105 passed**.
- `Playwright`: 2026-11-27 13:07:57Z to 13:10:48Z. **52 passed** (1.4 minutes). The conflict test passed on the first attempt (2.5 seconds). The keyboard test passed on the first attempt (405 ms). The password replacement passed on the first attempt (1.9 seconds). The wrong-current-password limit passed on the first attempt (1.5 seconds).

Performance on the same commit, not required: [46004456032](https://github.com/bob1525/linear-build/actions/runs/46004456032), conclusion success.
