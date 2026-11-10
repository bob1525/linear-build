# Auth hardening

## What was done

The sign-in page no longer shows Fill demo on a production server. `showDemoCredentials` returns true for `npm run dev`. It returns false when `NODE_ENV` is `production`, unless `NORTHSTAR_SHOW_DEMO=1`. `NORTHSTAR_SHOW_DEMO=0` hides it even in development. The login page is a server component and passes the demo email, password, and account list into the form only when that function is true. The client bundle does not contain `demo1234`. The end-to-end server sets `NORTHSTAR_SHOW_DEMO=1` in `playwright.config.ts`, so the existing test `demo hint matches the documented password` still sees the button and still checks that it fills Ava’s email. That test was not edited.

Login and registration are rate limited in the Node process.

- A failed sign-in counts. A successful one does not. The next attempt is rejected, before the password check, after 8 failures for that email or 40 failures for that client address inside 15 minutes.
- A registration counts when the form is valid, whether or not the email is new. The next attempt is rejected after 5 for that email or 30 for that client address inside 15 minutes. An invalid form does not count.
- The address is the first `x-forwarded-for` value, then `x-real-ip`, then the shared key `local`.
- The response is `Too many attempts. Try again in a few minutes.`

`README.md` describes the Fill demo rule and these limits. `.env.example` notes that `NORTHSTAR_SHOW_DEMO` stays unset on a public server.

## Keyboard shortcut flake

Recorded from the Stage 2 push, not changed here. On CI [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385) (`9e5102f`), `opens the new issue dialog from the keyboard` failed once and passed on the retry. Playwright reported `1 flaky` and `43 passed`. The job stayed green because `playwright.config.ts` already sets `retries: 1` when `CI` is set. The assertion was not changed, and this stage does not edit `e2e/issues.spec.ts`.

The failure was `getByRole('dialog', { name: 'New issue' })` not visible within 10 seconds after `page.keyboard.press("c")`. `login()` in `e2e/helpers.ts` finishes when the URL matches `/p/ORB`. The `c` shortcut is a `window` keydown listener added in an effect in `src/components/shell.tsx`, which runs after the shell hydrates. A press that lands before that effect is attached does nothing, and the dialog never opens from it. The board does not autofocus an input, so the handler’s typing guard is not the miss. The retry passes once the client bundle is already loaded. The following CI run, [42861456974](https://github.com/bob1525/linear-build/actions/runs/42861456974), ran the same test on the first attempt. Locally in this stage it passed in 388 ms.

## Verification method

1. `npm run lint`, `npx tsc --noEmit`, and `npm test`.
2. `npm run test:e2e`, including the unchanged demo-hint test and the two new limit tests.
3. `curl` the production login page with `NORTHSTAR_SHOW_DEMO` unset and confirm the HTML has neither `Fill demo` nor `demo1234`.
4. After the push, read the CI jobs for this commit.

## Evidence

Local, 2026-11-10, Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **77/77**. The new file is `tests/unit/auth-hardening.test.ts`, 6 tests. The previous 71 still pass |
| `npm run test:e2e` | **46 passed** (1.1 minutes). Two new tests: `blocks a run of bad passwords for one email` and `blocks repeated registration of one email`. The previous 44 passed, including `demo hint matches the documented password` and the keyboard-dialog test |
| Production login HTML, flag unset | `curl` of `next start` on port 3300 returned the sign-in form and did not contain `Fill demo` or `demo1234`. The server bundle reads `process.env.NORTHSTAR_SHOW_DEMO` at request time. `demo1234` appears in `.next/server/app/login/page.js` and not in `.next/static` |

## Tests added

6 unit tests and 2 end-to-end tests. No existing test was deleted or edited.

## Problems found

The keyboard flake above. It is a race with hydration, and the test still has the same assertion.

## Remaining limitations

- The counters are a `Map` in this process. A restart clears them. A second process does not see them. That matches the single-writer SQLite deploy and does not hold on several serverless instances.
- The client address comes from `x-forwarded-for` or `x-real-ip`. A caller can send those headers. With neither header, every caller shares `local`.
- Successful sign-ins are not limited. The failed-password budget still allows 8 bcrypt checks per email per window.
- There is no email verification and no password reset. The seeded password is still `demo1234`.
- `NORTHSTAR_SHOW_DEMO=1` puts the block back. The end-to-end server does that on purpose. A public host should not.
- `docs/screenshots/login.png` was captured while the block was visible. It is the `npm run dev` sign-in page, not a production page.

## Actions run

Recorded after the workflow for this commit finishes.
