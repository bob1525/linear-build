# Navigation refresh cleanup

Sign-in, sign-up, and logout no longer call `router.refresh()` immediately after `router.push`. The session cookie is already set or cleared by the server action, and the next navigation renders the signed-in or signed-out page. No existing test was deleted or weakened.

## What was done

`src/components/auth-form.tsx` is the success path for both sign-in and sign-up. It now only pushes the redirect from the action. `src/components/shell.tsx` does the same after logout. Creating a project already worked this way: a refresh beside the push can cancel the navigation, which is the race that left sign-up on `/welcome` in an earlier round.

The actions themselves are unchanged. Sign-in and sign-up still call `createSession` before they return the path. Logout still calls `destroySession` and returns `/login`. The app layout still requires a user, and the sign-in page still sends a signed-in visitor to their landing project.

The conflict prompt’s Reload path applies the title from the conflict response and ignores a joined or stale field value. That change is described under Problems found. It does not change sign-in, sign-up, or logout.

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

`blockedReloadValue`, `titleAfterReload`, and `pageCaughtReload` in `src/lib/title-reload.ts` are covered by unit tests. The conflict test in `e2e/edge.spec.ts` was not changed.

## Verification after the change

Same commands, after Reload started using the title from the conflict response.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npm run typecheck` | Pass |
| `npm test` | **128/128** (18 files) in 17.44s. `tests/unit/title-reload.test.ts` grew from 3 tests to 6. The previous 125 still pass |
| `npm run test:e2e` | **59 passed** (1.5 minutes). One new test in `e2e/auth.spec.ts`. It passed on the first attempt (969 ms). Signup passed on the first attempt (485 ms). The batch-search test passed on the first attempt (1.7 seconds). The conflict test passed on the first attempt (2.5 seconds). The keyboard test passed on the first attempt (388 ms). The move test passed on the first attempt (1.9 seconds). The Backlog edge passed on the first attempt (794 ms). No flaky test |

## Problems found

The local suite on `4a4d398` passed, including the old refresh calls. This machine did not reproduce a cancelled sign-in, sign-up, or logout navigation. The calls were removed because they are the same competing-refresh pattern that already cancelled project creation and search in CI. The new test failed none of its assertions.

Push [46044127308](https://github.com/bob1525/linear-build/actions/runs/46044127308) of `0611475` passed on the first attempt, including the conflict test (2.9 seconds). Pull request [46044134407](https://github.com/bob1525/linear-build/actions/runs/46044134407) is not a pass. Playwright reported `1 flaky` and `58 passed`. `the later saver of an issue gets a conflict prompt` failed on the first attempt (15.3 seconds) and passed only on retry 1 (3.3 seconds). After Reload, the title field stayed on `Conflict1795801582083 marcus` joined to `Conflict1795801582083 original` for the whole 10 second timeout. The new sign-in test passed on the first attempt (1.2 seconds). Performance [46044134518](https://github.com/bob1525/linear-build/actions/runs/46044134518) succeeded (board 484 ms, list 431 ms, `status=ok`).

Reload waited for `router.refresh()` to commit the winning title. Under load that refresh does not commit within the assertion, so the field stays on the draft. A remount can also report the reloaded title joined to the loaded title. `onChange` was ignoring those values only until the next animation frame, and a late event stored one of them and marked the field dirty.

The conflict response now includes the current server title. Reload applies that string immediately and does not copy an older page title over it. The field rejects the draft, the loaded title, and either joined order, and writes the server title back. A normal edit still updates the field. The conflict test assertion was not changed.

Push [46045502884](https://github.com/bob1525/linear-build/actions/runs/46045502884) of `71356aa` is not a pass either. That build only rejected the joined string. Playwright reported `1 flaky` and `58 passed`. The conflict test failed on the first attempt (15.1 seconds) because the field stayed on `Conflict1795802239281 reload me`, then passed on retry 1 (3.4 seconds). The pull request run of that commit passed on the first attempt and is not the record, because the push of the same commit did not.

Push [46046659569](https://github.com/bob1525/linear-build/actions/runs/46046659569) of `754aca9` passed on the first attempt (conflict test 3.4 seconds, 59 passed). Pull request [46046667684](https://github.com/bob1525/linear-build/actions/runs/46046667684) is not a pass. Playwright reported `1 flaky` and `58 passed`. The conflict test failed on the first attempt (12.6 seconds): the field stayed on `Conflict1795802802983 marcus` joined to `Conflict1795802802983 original`. Retry 1 passed (3.0 seconds). The sign-in test passed on the first attempt. Performance [46046667717](https://github.com/bob1525/linear-build/actions/runs/46046667717) succeeded (board 478 ms, list 431 ms, `status=ok`).

The joined string was in the textarea after Reload even though the conflict response already had the server title. Assigning that title onto a dirty textarea can leave the previous title stuck on the end, and that DOM value can sit there without another React render. Reload now clears the textarea and writes the server title, then keeps correcting a draft, a loaded title, or either joined order for a short run of frames. A trusted edit that is none of those still updates the field. The conflict test assertion was not changed.

A later local Playwright command, without `npm run db:e2e`, left the signup test on `/welcome` with “That project key is already in use”. `LNP` was still in `prisma/e2e.db` from the previous suite. That run is not a product failure. The reset suite above created the project and opened `/p/LNP` on the first attempt.

## Remaining limitations

- Board, list, issue detail, relations, saved views, and the new-issue dialog still call `router.refresh()` after their own saves. Those calls are not paired with `router.push`. Search still commits a second time when a refresh drops its first push.
- The title guard matches the draft, the loaded title, and the exact joined string. A truncated join, or a join with a character between the two titles, is still treated as an edit.
- There is still no mail transport, forgot-password flow, or email verification. The seed password is still `demo1234`.
- SQLite stays the default. Nothing in this stage changes the database or the rate limits.

## Actions run

`0611475`, `71356aa`, and `754aca9` are not the recorded head. Their runs are the failures in Problems found. These runs are `3ff0965`. No flaky test and no retry.

Push of `3ff0965`: [46047753390](https://github.com/bob1525/linear-build/actions/runs/46047753390), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 18:12:57Z to 18:13:54Z. **128 passed** (18 files).
- `Playwright`: 2026-11-27 18:12:57Z to 18:15:58Z. **59 passed** (1.7 minutes). `sign-in and logout show the signed-in board and the sign-in page on the first attempt` passed on the first attempt (1.1 seconds). `signs up, creates a project, and shows the empty board` passed on the first attempt (805 ms). `shows which issue failed when part of a batch no longer exists` passed on the first attempt (1.8 seconds). `the later saver of an issue gets a conflict prompt` passed on the first attempt (3.5 seconds). The keyboard test passed on the first attempt (426 ms). The move test passed on the first attempt (2.1 seconds). The Backlog edge passed on the first attempt (882 ms).

Pull request of `3ff0965`: [46047762063](https://github.com/bob1525/linear-build/actions/runs/46047762063), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 18:13:01Z to 18:13:53Z. **128 passed** (18 files).
- `Playwright`: 2026-11-27 18:13:01Z to 18:16:23Z. **59 passed** (1.7 minutes). The sign-in test passed on the first attempt (984 ms). Signup passed on the first attempt (625 ms). The batch-search test passed on the first attempt (5.3 seconds). The conflict test passed on the first attempt (3.3 seconds). The keyboard test passed on the first attempt (544 ms). The move test passed on the first attempt (2.0 seconds). The Backlog edge passed on the first attempt (919 ms).

Performance on the same commit, not required: [46047762300](https://github.com/bob1525/linear-build/actions/runs/46047762300), conclusion success, 18:13:01Z to 18:14:08Z. Board-load median **396 ms**, `budgetMs=1200` `status=ok`. List-load median **382 ms**, 19 mounted at the top and 18 at the end.
