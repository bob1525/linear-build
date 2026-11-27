# Forgot password

A signed-out person can request a reset link at `/forgot-password`. The link expires in 30 minutes, works once, and is stored only as a SHA-256 hash. Resetting replaces the password and deletes every session for that account, then signs in the browser that used the link. No existing test was deleted or weakened. There is still no email verification.

## What was done

`requestPasswordReset` and `resetPassword` in `src/lib/password-reset.ts` use the Stage 2 mail layer. The raw token is 32 random bytes. The database stores `sha256` of that token in `PasswordResetToken`, with `expiresAt`. A new request deletes older tokens for that account. Using the link deletes the row, writes the new password hash, and deletes every `Session` for the user. A second use of the same link, or a use at the expiry instant, gets “This reset link is invalid or has expired.” A mismatched confirmation does not consume the token.

The reply is the same whether or not the email matches an account: “If an account exists for that email, a reset link is ready. It expires in 30 minutes and works once.” An unknown address writes no token and no outbox line. Every well-formed request still consumes a `RateLimitEvent` slot, 5 per email and 30 per address in the same 15 minute window as the other auth limits (`reset-email` and `reset-address`). The limit message is the same one sign-in uses, and it does not say whether the account exists.

When `resolveMail` is disabled, the page shows “Password reset email is unavailable until mail delivery is configured.” and does not render the send button. That path writes no token and no rate-limit row. `/forgot-password` is rendered on each request. A static build had frozen the build machine’s mail mode, so a server with the outbox still showed the unavailable sentence.

The sign-in form links to the page. The account page still does not email a reset link. SQLite and Postgres both gain `20261127100200_password_reset` and `20261127130000_password_reset`. An existing SQLite file that already has the table is baselined the same way as `RateLimitEvent`.

The Playwright mail server sets `MAIL_TRANSPORT=outbox` and `MAIL_E2E_OUTBOX=1`. That flag is the only way a production process writes the development outbox. Without it, production still refuses the outbox. The main end-to-end server does not set the flag, so its forgot-password page stays unavailable. `.env.example` says not to set the flag on a public server.

## How it was verified

2026-11-27, after the dynamic page, on Node v22.23.4. Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`. Playwright retries stay at 1 in CI and 0 locally. A retry is not a pass.

Unit tests cover the shared reply, the hash, the 30 minute expiry, a replaced link, single use, session deletion, both rate limits, and the disabled production path. The mail end-to-end test reads the link from `.mail/e2e-outbox.jsonl`, sets a new password, checks that the other signed-in browser is sent to sign-in, checks that the used link fails, and checks that an unknown email adds no outbox line. The main server test checks the unavailable sentence and that the send button is absent.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | Exit 0. No new warning. It still prints the existing `src/components/issue-detail.tsx` hook warning. The `next lint` deprecation notice is not a failure |
| `npm run typecheck` | Pass |
| `npm test` | **141/141** (20 files) in 18.53s. Five tests are new in `tests/unit/password-reset.test.ts`. The previous 136 still pass |
| `npm run test:e2e` | **61 passed** (1.8 minutes). `forgot password says reset email is unavailable when mail is off` passed on the first attempt (234 ms). `a reset link from the outbox changes the password and signs out the other session` passed on the first attempt (2.2 seconds). `sign-in and logout show the signed-in board and the sign-in page on the first attempt` passed on the first attempt (918 ms). `signs up, creates a project, and shows the empty board` passed on the first attempt (494 ms). `shows which issue failed when part of a batch no longer exists` passed on the first attempt (1.7 seconds). `the later saver of an issue gets a conflict prompt` passed on the first attempt (5.7 seconds). `the account link opens the password form` passed on the first attempt (490 ms). The keyboard test passed on the first attempt (410 ms). The move test passed on the first attempt (1.9 seconds). The Backlog edge passed on the first attempt (507 ms). No flaky test |

## Problems found

The first local Playwright run failed the mail test. `/forgot-password` was a static page, built while mail was off, so the outbox server still rendered the unavailable sentence and the send button was missing. The assertion was not changed. The page is now dynamic, and the suite above passed on the first attempt. That failed run is not a pass.

A delivery failure deletes the token and returns the same ready message as an unknown address. The server logs the mail error. The page does not say the account exists, and it also does not say the send failed.

## Remaining limitations

- There is still no email verification. Seeded users are not marked verified because that flow does not exist. The seed password is still `demo1234`.
- The reset link uses the request `Host`, and `https` only when `TRUST_PROXY=1` and the forwarded protocol says so. A proxy that does not match that will put the wrong origin in the message.
- Two overlapping requests can each send a link if the second starts before the first token is stored. Each link still works once. A later request deletes the tokens it can see.
- `MAIL_E2E_OUTBOX=1` is a test switch. A public server that sets it writes the outbox file instead of refusing it.
- `docs/screenshots/change-password.png` was not recaptured. The sign-in screenshot does not show the new Forgot password link.
- AUTH PLAIN, the 8 second SMTP timeout, and the local JSONL outbox are unchanged. Certificate verification still cannot be turned off with an environment variable.
- The title guard still matches only the draft, the loaded title, and the exact joined string. Board, list, issue detail, relations, saved views, and the new-issue dialog still call `router.refresh()` after their own saves.
- SQLite stays the default. A failed send looks like a prepared link and leaves no token.
