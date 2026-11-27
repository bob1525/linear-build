# Follow-up upgrade audit

This round followed the upgrade-round audit. It fixed conflict reload, windowed long lists, added a signed-in password change, and gave the board, the list, the dialogs, and the password form keyboard and screen-reader paths. No test was deleted or weakened. The pull request was not merged, and repository settings were not changed.

## The four stages

| Stage | What changed | Self-check |
| --- | --- | --- |
| 1. Conflict reload | Reload writes the winning title once and remounts the field, so the draft is not joined onto the other person’s title. The assertion in `e2e/edge.spec.ts` is unchanged. | [CONFLICT_RELOAD_FIX.md](CONFLICT_RELOAD_FIX.md) |
| 2. List window | A list of 24 or more rows mounts the visible slice. Shorter lists stay fully mounted. Select all still uses the filtered ids. | [LIST_VIRTUALIZATION.md](LIST_VIRTUALIZATION.md) |
| 3. Change password | A signed-in person can replace their password at `/account`. Other sessions for that account are signed out. A wrong current password has its own rate-limit rows. | [PASSWORD_CHANGE.md](PASSWORD_CHANGE.md) |
| 4. Accessibility | Arrow keys, Home, and End move through windowed cards and rows and scroll the target into the window. Dialogs trap focus. The conflict prompt focuses Reload. The password form names its fields. | [A11Y.md](A11Y.md) |

## Tests

The count going in was 95 unit tests and 47 end-to-end tests. This round added **19** unit tests and **9** end-to-end tests. It is now **114** unit tests and **56** end-to-end tests.

| Added | Where |
| --- | --- |
| 3 unit | Stage 1. `tests/unit/title-reload.test.ts` |
| 4 unit and 1 end-to-end | Stage 2. `tests/unit/list-window.test.ts`, and the long-list slice test |
| 3 unit and 4 end-to-end | Stage 3. One schema test, two rate-limit tests, and `e2e/password.spec.ts` |
| 9 unit and 4 end-to-end | Stage 4. `tests/unit/a11y.test.ts` and `e2e/a11y.spec.ts`. The conflict test also checks focus on the prompt |

The original tests are still in the suite, including `opens the new issue dialog from the keyboard`, `the later saver of an issue gets a conflict prompt`, `demo hint matches the documented password`, the drag tests, the relation markers, and the batch tests.

### Local rerun for this audit

2026-11-27, Node v22.23.4, 4 cores, 16003 MB, on `08dfded` before this file was committed:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npx tsc --noEmit` | Pass |
| `npm test` | **114/114** (16 files) |
| `npm run test:e2e` | **56 passed** (1.5 minutes). The conflict test passed on the first attempt (2.2 seconds). The keyboard test passed on the first attempt (401 ms). No flaky test |

### CI runs from this round

Each accepted head was green on both the push workflow and the pull request workflow. No flaky test on those heads. The keyboard test and the conflict test passed on the first attempt in each feature run below.

| Stage | Run | Result |
| --- | --- | --- |
| 1. Fix `ac72eee` push | [45999804808](https://github.com/bob1525/linear-build/actions/runs/45999804808) | success. 98/98 (12:34:43Z–12:35:46Z). Playwright 12:34:43Z–12:36:54Z, 47 passed, conflict 5.7 seconds, keyboard 397 ms |
| 1. Fix `ac72eee` pull request | [45999812567](https://github.com/bob1525/linear-build/actions/runs/45999812567) | success. 98/98 (12:34:46Z–12:35:37Z). Playwright 12:34:47Z–12:37:32Z, 47 passed, conflict 3.3 seconds, keyboard 567 ms |
| 1. Evidence `4d86640` push | [46000253857](https://github.com/bob1525/linear-build/actions/runs/46000253857) | success. 98/98 (12:37:58Z–12:39:08Z). Playwright 12:37:58Z–12:40:24Z, 47 passed, conflict 2.4 seconds, keyboard 451 ms |
| 1. Evidence `4d86640` pull request | [46000263140](https://github.com/bob1525/linear-build/actions/runs/46000263140) | success. 98/98 (12:38:02Z–12:39:07Z). Playwright 12:38:02Z–12:41:01Z, 47 passed, conflict 3.6 seconds, keyboard 538 ms |
| 2. Window `0041bce` push | [46002297279](https://github.com/bob1525/linear-build/actions/runs/46002297279) | success. 102/102 (12:52:36Z–12:53:44Z). Playwright 12:52:36Z–12:55:29Z, 48 passed, conflict 2.6 seconds, keyboard 589 ms |
| 2. Window `0041bce` pull request | [46002307434](https://github.com/bob1525/linear-build/actions/runs/46002307434) | success. 102/102 (12:52:41Z–12:53:35Z). Playwright 12:52:41Z–12:55:29Z, 48 passed, conflict 5.7 seconds, keyboard 494 ms |
| 2. Performance `0041bce` | [46002307431](https://github.com/bob1525/linear-build/actions/runs/46002307431) | success. Board-load median **415 ms**, `status=ok`. List-load median **375 ms**, 19 mounted at the top and 18 at the end |
| 2. Evidence `9f7c012` push | [46002842258](https://github.com/bob1525/linear-build/actions/runs/46002842258) | success. Unit 12:56:37Z–12:57:19Z. Playwright 12:56:36Z–12:59:14Z. Docs only |
| 2. Evidence `9f7c012` pull request | [46002854118](https://github.com/bob1525/linear-build/actions/runs/46002854118) | success. Unit 12:56:42Z–12:57:34Z. Playwright 12:56:42Z–13:00:27Z. Docs only |
| 2. Performance `9f7c012` | [46002854052](https://github.com/bob1525/linear-build/actions/runs/46002854052) | success. 12:56:40Z–12:58:21Z |
| 3. Password `1913b03` push | [46004443850](https://github.com/bob1525/linear-build/actions/runs/46004443850) | success. 105/105 (13:07:51Z–13:08:34Z). Playwright 13:07:51Z–13:10:36Z, 52 passed, conflict 2.5 seconds, keyboard 552 ms |
| 3. Password `1913b03` pull request | [46004455900](https://github.com/bob1525/linear-build/actions/runs/46004455900) | success. 105/105 (13:07:57Z–13:08:50Z). Playwright 13:07:57Z–13:10:48Z, 52 passed, conflict 2.5 seconds, keyboard 405 ms |
| 3. Performance `1913b03` | [46004456032](https://github.com/bob1525/linear-build/actions/runs/46004456032) | success |
| 3. Evidence `3473457` push | [46004934638](https://github.com/bob1525/linear-build/actions/runs/46004934638) | success. 105/105 (13:11:18Z–13:12:11Z). Playwright 13:11:18Z–13:13:58Z, 52 passed, no flake |
| 3. Evidence `3473457` pull request | [46004943577](https://github.com/bob1525/linear-build/actions/runs/46004943577) | success. 105/105 (13:11:22Z–13:12:08Z). Playwright 13:11:21Z–13:14:24Z, 52 passed, no flake |
| 4. Accessibility `fdde8e8` push | [46007712765](https://github.com/bob1525/linear-build/actions/runs/46007712765) | success. 114/114 (13:30:41Z–13:31:48Z). Playwright 13:30:41Z–13:33:08Z, 56 passed, conflict 2.6 seconds, keyboard 437 ms |
| 4. Accessibility `fdde8e8` pull request | [46007723387](https://github.com/bob1525/linear-build/actions/runs/46007723387) | success. 114/114 (13:30:44Z–13:31:25Z). Playwright 13:30:45Z–13:33:30Z, 56 passed, conflict 3.1 seconds, keyboard 426 ms |
| 4. Performance `fdde8e8` | [46007723786](https://github.com/bob1525/linear-build/actions/runs/46007723786) | success. Board-load median **446 ms**, `status=ok`. List-load median **413 ms**, 19 mounted at the top and 18 at the end |
| 4. Evidence `08dfded` push | [46008221694](https://github.com/bob1525/linear-build/actions/runs/46008221694) | success. 114/114 (13:34:07Z–13:35:04Z). Playwright 13:34:06Z–13:36:51Z, 56 passed, no flake |
| 4. Evidence `08dfded` pull request | [46008231392](https://github.com/bob1525/linear-build/actions/runs/46008231392) | success. 114/114 (13:34:10Z–13:35:11Z). Playwright 13:34:11Z–13:36:59Z, 56 passed, no flake |
| 4. Performance `08dfded` | [46008231264](https://github.com/bob1525/linear-build/actions/runs/46008231264) | success. Board-load median **504 ms**, `budgetMs=1200` `status=ok`. List-load median **441 ms**, 19 mounted at the top and 19 at the end |

The Actions run for this audit commit is in the next section.

## Remaining limitations

- There is no email verification and no forgot-password flow. Both need a mail provider. The seed password is still `demo1234`. `NORTHSTAR_SHOW_DEMO=1` shows Fill demo again.
- SQLite is one writer. One `next start` process is the deploy that matches this file. Several processes, or a serverless host, will not share it. The SQL in `prisma/migrations` does not run on Postgres. A multi-instance database would need a new provider, a new `DATABASE_URL`, and a new migration history. This repository does not add that path.
- A row outside a windowed board column or list is not in the tab order or the accessibility tree until arrow keys, Home, End, or scrolling mount it. The mounted row’s `aria-setsize` is the full count. Select all still uses every filtered id.
- Dragging a card is still pointer-only. Keyboard users change status from the list menu or the issue page.
- `TRUST_PROXY` defaults to off. Forwarded address headers are ignored, and every caller shares the `local` bucket. Set it to `1` only when the proxy replaces those headers.
- Classic branch protection on `main` returned **403** to this token on 2026-11-27, and the ruleset list was empty. An admin still has to require `Lint, typecheck, and unit tests` and `Playwright`. Do not require `Board load`. CI runs on push and pull request, so each of those names appears twice.
- `MERGE_READINESS.md` was stale at the start of this stage. It still said a flaky `opens the new issue dialog from the keyboard` could be merged, and it cited 77 unit tests and 46 end-to-end tests from `0917928`. This stage rewrites that checklist. The required check names are unchanged. The keyboard race and the conflict-reload race are fixed, and the suite is 114 and 56. [UPGRADE_ROUND_AUDIT.md](UPGRADE_ROUND_AUDIT.md) still describes the joined-title race as it was on `f62b366`. That description is the record of that commit, not the current merge rule.
- `Board load` warns above 1200 ms and does not fail. Drag frame gap is recorded only. On `08dfded` the board-load median was 504 ms and the list-load median was 441 ms.
- Contrast was not measured. Menu options are drawn outside the dialog, so Tab while a menu is open does not move through those options.

## Actions run

Push of `c353d4c` (the audit, the README index, and the merge checklist): [46010212533](https://github.com/bob1525/linear-build/actions/runs/46010212533), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 13:47:59Z to 13:48:42Z. **114 passed** (16 files).
- `Playwright`: 2026-11-27 13:47:59Z to 13:50:41Z. **56 passed** (1.6 minutes). `the later saver of an issue gets a conflict prompt` passed on the first attempt (3.5 seconds). The keyboard test passed on the first attempt (446 ms).

Pull request of `c353d4c`: [46010220492](https://github.com/bob1525/linear-build/actions/runs/46010220492), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 13:48:03Z to 13:49:04Z. **114 passed** (16 files).
- `Playwright`: 2026-11-27 13:48:03Z to 13:50:28Z. **56 passed** (1.3 minutes). The conflict test passed on the first attempt (3.6 seconds). The keyboard test passed on the first attempt (414 ms).

Hosted Performance of `c353d4c`: [46010220404](https://github.com/bob1525/linear-build/actions/runs/46010220404), conclusion success, 13:48:02Z to 13:49:24Z. Board-load median **447 ms**, `budgetMs=1200` `status=ok`. List-load median **398 ms**, 19 mounted at the top and 18 at the end.
