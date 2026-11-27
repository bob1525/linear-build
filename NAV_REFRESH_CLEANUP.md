# Navigation refresh cleanup

Sign-in, sign-up, and logout no longer call `router.refresh()` immediately after `router.push`. The session cookie is already set or cleared by the server action, and the next navigation renders the signed-in or signed-out page. No existing test was deleted or weakened.

## What was done

`src/components/auth-form.tsx` is the success path for both sign-in and sign-up. It now only pushes the redirect from the action. `src/components/shell.tsx` does the same after logout. Creating a project already worked this way: a refresh beside the push can cancel the navigation, which is the race that left sign-up on `/welcome` in an earlier round.

The actions themselves are unchanged. Sign-in and sign-up still call `createSession` before they return the path. Logout still calls `destroySession` and returns `/login`. The app layout still requires a user, and the sign-in page still sends a signed-in visitor to their landing project.

## Baseline before the change

2026-11-27, on `4a4d398` (`4a4d398886e2b90157da0b6372327d220c44705b`), before this change. Node v22.23.4, 4 cores. Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npm run typecheck` | Pass |
| `npm test` | **125/125** (18 files) in 18.70s |
| `npm run test:e2e` | **58 passed** (1.4 minutes). Signup passed on the first attempt (545 ms). The batch-search test passed on the first attempt (1.4 seconds). The conflict test passed on the first attempt (6.3 seconds). The keyboard test passed on the first attempt (430 ms). The move test passed on the first attempt (2.2 seconds). The Backlog edge passed on the first attempt (817 ms). No flaky test |

## How it was verified

Same day, after removing the two refresh calls and adding the landing-state checks.

The new Playwright test signs in as Ava Chen, expects `/p/ORB`, the Orbit heading, the Log out control, and her email, and expects the sign-in heading to be gone. It then opens `/login` again and expects the board, because the session is still set. Logout expects `/login`, the sign-in heading, and no Log out control or Orbit heading. A following visit to `/p/ORB` stays on the sign-in page. The existing sign-up test now also expects the empty-workspace heading, the Change password link, and no “Create your workspace” heading before it creates the project. Playwright retries stay at 1 in CI and 0 locally. A retry is not a pass.

## Verification after the change

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npm run typecheck` | Pass |
| `npm test` | **125/125** (18 files) in 18.42s. No unit tests were added. The previous 125 still pass |
| `npm run test:e2e` | **59 passed** (1.4 minutes). One new test in `e2e/auth.spec.ts`. It passed on the first attempt (936 ms). Signup passed on the first attempt (496 ms). The batch-search test passed on the first attempt (1.4 seconds). The conflict test passed on the first attempt (5.8 seconds). The keyboard test passed on the first attempt (422 ms). The move test passed on the first attempt (2.2 seconds). The Backlog edge passed on the first attempt (786 ms). No flaky test |

## Problems found

The local suite on `4a4d398` passed, including the old refresh calls. This machine did not reproduce a cancelled sign-in, sign-up, or logout navigation. The calls were removed because they are the same competing-refresh pattern that already cancelled project creation and search in CI. The new test failed none of its assertions.

## Remaining limitations

- Board, list, issue detail, relations, saved views, and the new-issue dialog still call `router.refresh()` after their own saves. Those calls are not paired with `router.push`. Search still commits a second time when a refresh drops its first push.
- There is still no mail transport, forgot-password flow, or email verification. The seed password is still `demo1234`.
- SQLite stays the default. Nothing in this stage changes the database or the rate limits.
