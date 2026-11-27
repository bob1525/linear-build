# Continued upgrade audit

This round followed the follow-up audit. It added a keyboard move for a focused board card, recaptured the production sign-in page and the change-password page, counted successful sign-ins in one statement, and added an optional Postgres path. SQLite stays the default. No test was deleted or weakened. The pull request was not merged, and repository settings were not changed.

## The four stages

| Stage | What changed | Self-check |
| --- | --- | --- |
| 1. Keyboard card move | Alt and the left or right arrow move a focused board card to the neighboring column. The save is the same path a drop uses. Plain arrows still move focus. | [KEYBOARD_MOVE.md](KEYBOARD_MOVE.md) |
| 2. Screenshot refresh | `login.png` is the production sign-in page. Fill demo and `demo1234` are not on it. `change-password.png` is the signed-in `/account` page. | [SCREENSHOTS_REFRESH.md](SCREENSHOTS_REFRESH.md) |
| 3. Auth limits | A successful sign-in counts: 120 per email and 400 per address in 15 minutes. The count and the insert are one statement. Failed sign-in, registration, and password-change caps are unchanged. | [AUTH_LIMITS_TIGHTEN.md](AUTH_LIMITS_TIGHTEN.md) |
| 4. Postgres path | A `postgresql://` or `postgres://` URL uses `prisma/postgres` and `npm run db:migrate:pg`. Any other URL stays on the SQLite client. | [POSTGRES_PATH.md](POSTGRES_PATH.md) |

## Tests

The count going in was 114 unit tests and 56 end-to-end tests. This round added **11** unit tests and **2** end-to-end tests. It is now **125** unit tests and **58** end-to-end tests.

| Added | Where |
| --- | --- |
| 4 unit and 2 end-to-end | Stage 1. `tests/unit/keyboard-move.test.ts` and `e2e/keyboard-move.spec.ts` |
| None | Stage 2. No test was edited. The capture script refuses to write `login.png` when the demo block is present |
| 4 unit | Stage 3. `tests/unit/auth-limits.test.ts`. The password-address test also gained two assertions |
| 3 unit | Stage 4. `tests/unit/postgres-path.test.ts` |

The original tests are still in the suite, including `opens the new issue dialog from the keyboard`, `the later saver of an issue gets a conflict prompt`, `shows which issue failed when part of a batch no longer exists`, `signs up, creates a project, and shows the empty board`, the drag tests, and the lockout tests.

### Local rerun for this audit

2026-11-27, Node v22.23.4, 4 cores, 16003 MB, on `b241b79` before this file was committed:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npm run typecheck` | Pass |
| `npm test` | **125/125** (18 files) |
| `npm run test:e2e` | **58 passed** (1.5 minutes). Signup passed on the first attempt (561 ms). The batch-search test passed on the first attempt (5.1 seconds). The conflict test passed on the first attempt (3.2 seconds). The keyboard test passed on the first attempt (406 ms). The move test passed on the first attempt (1.9 seconds). No flaky test |

### CI runs from this round

Each accepted head was green on both the push workflow and the pull request workflow, with no flaky test. A Playwright retry is not a pass. The runs that only went green on a retry, and the pull request that failed, are listed with the stage and are not the recorded head.

| Stage | Run | Result |
| --- | --- | --- |
| 1. Move `62438c1` push | [46013119601](https://github.com/bob1525/linear-build/actions/runs/46013119601) | The move test was flaky. The reload ran before the save finished. Retry 1 passed. That retry is not a pass |
| 1. Move `62438c1` pull request | [46013129253](https://github.com/bob1525/linear-build/actions/runs/46013129253) | success on the first attempt. Not the recorded head. The test now waits for the save |
| 1. Move `ca64564` push | [46014023762](https://github.com/bob1525/linear-build/actions/runs/46014023762) | success. 118/118 (14:13:53Z–14:14:53Z). Playwright 14:13:53Z–14:16:44Z, 58 passed, move test 2.5 seconds, no flake |
| 1. Move `ca64564` pull request | [46014038456](https://github.com/bob1525/linear-build/actions/runs/46014038456) | success. 118/118 (14:13:59Z–14:14:41Z). Playwright 14:13:59Z–14:16:47Z, 58 passed, move test 2.8 seconds, no flake |
| 1. Performance `ca64564` | [46014038473](https://github.com/bob1525/linear-build/actions/runs/46014038473) | success. Board-load median **488 ms**, `status=ok`. List-load median **438 ms**, 19 mounted at the top and 18 at the end |
| 1. Evidence `04be90a` push | [46014552205](https://github.com/bob1525/linear-build/actions/runs/46014552205) | success. 118/118 (14:17:18Z–14:18:14Z). Playwright 14:17:17Z–14:19:42Z, 58 passed, move test 2.0 seconds, no flake |
| 1. Evidence `04be90a` pull request | [46014561379](https://github.com/bob1525/linear-build/actions/runs/46014561379) | success. 118/118 (14:17:20Z–14:17:59Z). Playwright 14:17:21Z–14:20:21Z, 58 passed, move test 2.0 seconds, no flake |
| 1. Performance `04be90a` | [46014561289](https://github.com/bob1525/linear-build/actions/runs/46014561289) | success. Board-load median **448 ms**, `status=ok`. List-load median **381 ms**, 19 mounted at the top and 18 at the end |
| 2. Screenshots `6c34d33` push | [46016194538](https://github.com/bob1525/linear-build/actions/runs/46016194538) | success. 118/118 (14:28:10Z–14:29:01Z). Playwright 14:28:10Z–14:30:58Z, 58 passed, no flake |
| 2. Screenshots `6c34d33` pull request | [46016205180](https://github.com/bob1525/linear-build/actions/runs/46016205180) | success. 118/118 (14:28:14Z–14:29:05Z). Playwright 14:28:15Z–14:31:31Z, 58 passed, no flake |
| 2. Performance `6c34d33` | [46016205112](https://github.com/bob1525/linear-build/actions/runs/46016205112) | success. Board-load median **468 ms**, `status=ok`. List-load median **407 ms**, 19 mounted at the top and 19 at the end |
| 2. Evidence `3f24747` push | [46016772612](https://github.com/bob1525/linear-build/actions/runs/46016772612) | success. 118/118 (14:32:01Z–14:32:51Z). Playwright 14:32:01Z–14:34:57Z, 58 passed, no flake |
| 2. Evidence `3f24747` pull request | [46016781774](https://github.com/bob1525/linear-build/actions/runs/46016781774) | success. 118/118 (14:32:05Z–14:32:59Z). Playwright 14:32:04Z–14:34:59Z, 58 passed, no flake |
| 2. Performance `3f24747` | [46016781759](https://github.com/bob1525/linear-build/actions/runs/46016781759) | success. Board-load median **475 ms**, `status=ok`. List-load median **443 ms**, 19 mounted at the top and 19 at the end |
| 3. Limits `a8585a2` push | [46020029229](https://github.com/bob1525/linear-build/actions/runs/46020029229) | success. 122/122 (14:53:58Z–14:54:50Z). Playwright 14:53:57Z–14:56:51Z, 58 passed, no flake |
| 3. Limits `a8585a2` pull request | [46020039459](https://github.com/bob1525/linear-build/actions/runs/46020039459) | success. 122/122 (14:54:01Z–14:54:51Z). Playwright 14:54:02Z–14:57:09Z, 58 passed, no flake |
| 3. Performance `a8585a2` | [46020039460](https://github.com/bob1525/linear-build/actions/runs/46020039460) | success. Board-load median **422 ms**, `status=ok`. List-load median **373 ms**, 19 mounted at the top and 18 at the end |
| 3. Evidence `a85536f` push | [46020637676](https://github.com/bob1525/linear-build/actions/runs/46020637676) | success. 122/122 (14:58:08Z–14:59:14Z). Playwright 14:58:08Z–15:00:55Z, 58 passed, no flake |
| 3. Evidence `a85536f` pull request | [46020647573](https://github.com/bob1525/linear-build/actions/runs/46020647573) | success. 122/122 (14:58:12Z–14:59:09Z). Playwright 14:58:12Z–15:01:16Z, 58 passed, no flake |
| 3. Performance `a85536f` | [46020647667](https://github.com/bob1525/linear-build/actions/runs/46020647667) | success. Board-load median **429 ms**, `status=ok`. List-load median **376 ms**, 19 mounted at the top and 18 at the end |
| 4. Postgres `152e3c8` push | [46024345954](https://github.com/bob1525/linear-build/actions/runs/46024345954) | success. 125/125 and 58 passed, no retry |
| 4. Postgres `152e3c8` pull request | [46024361115](https://github.com/bob1525/linear-build/actions/runs/46024361115) | success only because the batch-search test retried. The URL stayed `/p/ORB`. That retry is not a pass |
| 4. Performance `152e3c8` | [46024362710](https://github.com/bob1525/linear-build/actions/runs/46024362710) | success. Board-load median **435 ms**, `status=ok`. List-load median **380 ms** |
| 4. Search retry `d1fcb40` push | [46025536154](https://github.com/bob1525/linear-build/actions/runs/46025536154) | success. 125/125 (15:30:39Z–15:31:43Z). Playwright 15:30:39Z–15:33:31Z, 58 passed, no flake |
| 4. Search retry `d1fcb40` pull request | [46025550052](https://github.com/bob1525/linear-build/actions/runs/46025550052) | success. 125/125 (15:30:45Z–15:31:56Z). Playwright 15:30:44Z–15:33:36Z, 58 passed, batch test 6.3 seconds, no flake |
| 4. Performance `d1fcb40` | [46025550099](https://github.com/bob1525/linear-build/actions/runs/46025550099) | success. Board-load median **475 ms**, `status=ok`. List-load median **448 ms**, 19 mounted at the top and 19 at the end |
| 4. Evidence note `e8bf337` push | [46026046733](https://github.com/bob1525/linear-build/actions/runs/46026046733) | success. 125/125 (15:34:05Z–15:35:06Z). Playwright 15:34:06Z–15:37:06Z, 58 passed, no flake |
| 4. Evidence note `e8bf337` pull request | [46026061020](https://github.com/bob1525/linear-build/actions/runs/46026061020) | failed. Signup stayed on `/welcome` on both attempts. The conflict test retried once. Neither is a pass |
| 4. Performance `e8bf337` | [46026060918](https://github.com/bob1525/linear-build/actions/runs/46026060918) | success. Board-load median **483 ms**, `status=ok`. List-load median **426 ms**, 19 mounted at the top and 19 at the end |
| 4. Navigation `a81b4d2` push | [46026996025](https://github.com/bob1525/linear-build/actions/runs/46026996025) | success. 125/125 (15:40:32Z–15:41:24Z). Playwright 15:40:32Z–15:43:09Z, 58 passed, signup 516 ms, conflict 3.2 seconds, no flake |
| 4. Navigation `a81b4d2` pull request | [46027006695](https://github.com/bob1525/linear-build/actions/runs/46027006695) | success. 125/125 (15:40:36Z–15:41:22Z). Playwright 15:40:36Z–15:43:35Z, 58 passed, signup 613 ms, conflict 3.4 seconds, no flake |
| 4. Performance `a81b4d2` | [46027006663](https://github.com/bob1525/linear-build/actions/runs/46027006663) | success. Board-load median **425 ms**, `status=ok`. List-load median **405 ms**, 19 mounted at the top and 18 at the end |
| 4. Evidence `b241b79` push | [46027503831](https://github.com/bob1525/linear-build/actions/runs/46027503831) | success. 125/125 (15:44:03Z–15:45:07Z). Playwright 15:44:02Z–15:46:24Z, 58 passed, no flake |
| 4. Evidence `b241b79` pull request | [46027516191](https://github.com/bob1525/linear-build/actions/runs/46027516191) | success. 125/125 (15:44:08Z–15:45:05Z). Playwright 15:44:07Z–15:46:48Z, 58 passed, no flake |
| 4. Performance `b241b79` | [46027516229](https://github.com/bob1525/linear-build/actions/runs/46027516229) | success. Board-load median **488 ms**, `status=ok`. List-load median **408 ms**, 19 mounted at the top and 19 at the end |

Screenshot hashes from stage 2: `login.png` is `3d2357e32db637c03795a4bf840c05f8de65ccb20c490bd81598c99adc039935`. `change-password.png` is `b7151b52695b994493762eea61e024565d6c17e45dfce13c14fa0c384f3a3420`. Both are 2880×1800.

The Actions run for this audit commit is in the last section.

## Remaining limitations

- There is no email verification and no forgot-password flow. Both need a mail provider. The seed password is still `demo1234`. `NORTHSTAR_SHOW_DEMO=1` shows Fill demo again.
- A successful sign-in stores its rate-limit row before `createSession`. If creating the session throws, that slot is already used. A request that already passed the failure pre-check can still finish one bcrypt comparison. Eight failures still reject the correct password for the rest of the window.
- With `TRUST_PROXY` unset, every caller shares the `local` address. Set it to `1` only when the proxy replaces the forwarded headers.
- SQLite stays the default. One `next start` process is the deploy that matches a SQLite file. Several processes can share one Postgres database, including `RateLimitEvent`, and they still cannot share one SQLite file. Nothing copies rows from the SQLite file into Postgres. `npm run db:push` still does not record history.
- The two schema files can drift. The model-text test fails the unit job when the model text differs. The app’s TypeScript type is the SQLite client, so a one-sided field is not a type error.
- The Postgres unit test uses embedded Postgres. That server is not a production database, and CI does not start a Postgres service. The parallel burst is still the SQLite test with two clients.
- A column still has no stored order. Alt and an arrow change status only. The drag handle is still pointer-only, and the keyboard path does not show the drag overlay.
- A row outside a windowed board column or list is not in the tab order until arrow keys, Home, End, or scrolling mount it.
- Sign-in, sign-up, and logout still call `router.refresh()` after `router.push`. Creating a project no longer does. Those three paths were not the failures in this round.
- `Board load` warns above 1200 ms and does not fail. On `b241b79` the board-load median was 488 ms and the list-load median was 408 ms.
- Classic branch protection on `main` returned **403** to this token on 2026-11-27, and the ruleset list was empty. An admin still has to require `Lint, typecheck, and unit tests` and `Playwright`. Do not require `Board load`. CI runs on push and pull request, so each of those names appears twice.
- [FOLLOWUP_UPGRADE_AUDIT.md](FOLLOWUP_UPGRADE_AUDIT.md) still says this repository does not add a Postgres path, and it still says keyboard users change status from the list or the issue page. Those sentences are the record of that round. The path and the keyboard move are in this round.

## Actions run

Push of `b7b23ba` (the audit, the README index, and the merge checklist): [46029414340](https://github.com/bob1525/linear-build/actions/runs/46029414340), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:57:22Z to 15:58:16Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:57:22Z to 16:00:29Z. **58 passed** (1.8 minutes). `signs up, creates a project, and shows the empty board` passed on the first attempt (905 ms). `shows which issue failed when part of a batch no longer exists` passed on the first attempt (2.1 seconds). `the later saver of an issue gets a conflict prompt` passed on the first attempt (6.3 seconds). The keyboard test passed on the first attempt (646 ms). The move test passed on the first attempt (2.4 seconds).

Pull request of `b7b23ba`: [46029423469](https://github.com/bob1525/linear-build/actions/runs/46029423469), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:57:26Z to 15:58:26Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:57:26Z to 16:00:18Z. **58 passed** (1.6 minutes). Signup passed on the first attempt (880 ms). The batch-search test passed on the first attempt (1.7 seconds). The conflict test passed on the first attempt (3.4 seconds). The keyboard test passed on the first attempt (532 ms). The move test passed on the first attempt (2.5 seconds).

Hosted Performance of `b7b23ba`: [46029423459](https://github.com/bob1525/linear-build/actions/runs/46029423459), conclusion success, 15:57:26Z to 15:58:47Z. Board-load median **432 ms**, `budgetMs=1200` `status=ok`. List-load median **390 ms**, 19 mounted at the top and 18 at the end.
