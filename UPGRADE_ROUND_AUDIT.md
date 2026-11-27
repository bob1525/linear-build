# Upgrade round audit

This round followed the hardening-round audit. It closed the keyboard-shortcut race, stored auth rate limits in SQLite, added a versioned migration history, and windowed long board columns. No test was deleted or weakened. The pull request was not merged, and repository settings were not changed.

## The four stages

| Stage | What changed | Self-check |
| --- | --- | --- |
| 1. Keyboard shortcut | `login()` waits until the shell has set `data-shortcuts="ready"` after attaching the `c` listener. The test in `e2e/issues.spec.ts` is unchanged. Playwright retries were not increased. | [KEYBOARD_FLAKE_FIX.md](KEYBOARD_FLAKE_FIX.md) |
| 2. Auth rate limits | Failed sign-ins and accepted registrations are rows in `RateLimitEvent`. `x-forwarded-for` and `x-real-ip` are ignored unless `TRUST_PROXY` is exactly `1`. | [AUTH_LIMITS.md](AUTH_LIMITS.md) |
| 3. Migrations | `prisma/migrations` has `20261127100000_init` and `20261127100100_rate_limit_event`. `npm run db:setup` applies them and then seeds. An older `db push` file with the Northstar tables is baselined. SQLite stays the default. | [MIGRATIONS.md](MIGRATIONS.md) |
| 4. Board columns | A column of 10 or more cards mounts the visible slice. The dragged card and cards just moved stay mounted. Shorter columns stay fully mounted. The list is not windowed. | [BOARD_VIRTUALIZATION.md](BOARD_VIRTUALIZATION.md) |

## Tests

The count going in was 77 unit tests and 46 end-to-end tests. This round added **18** unit tests and **1** end-to-end test. It is now **95** unit tests and **47** end-to-end tests.

| Added | Where |
| --- | --- |
| 0 | Stage 1 changed the shell and `login()` only |
| 6 unit | Stage 2. One test for ignored forwarded headers, and 5 tests for the SQLite counters, including a second process |
| 4 unit | Stage 3. `tests/unit/migrations.test.ts` |
| 8 unit and 1 end-to-end | Stage 4. `tests/unit/column-window.test.ts`, and the Relay backlog slice test |

The original tests are still in the suite, including `opens the new issue dialog from the keyboard`, `demo hint matches the documented password`, the drag tests, the relation markers, and the batch tests.

### Local rerun for this audit

2026-11-27, Node v22.23.4, on `4e3b3a4` before this file was committed:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **95/95** (13 files) |
| `npm run test:e2e` | **47 passed** (1.2 minutes). The keyboard test passed on the first attempt (392 ms). No flaky test |

### CI runs from this round

Each accepted head was green on both the push workflow and the pull request workflow. No flaky test on those heads. The keyboard test passed on the first attempt in each of them.

| Stage | Run | Result |
| --- | --- | --- |
| 1. Fix `7c9a36b` push | [45976755038](https://github.com/bob1525/linear-build/actions/runs/45976755038) | success. 77/77. Playwright 09:48:21Z–09:51:37Z, 46 passed, keyboard 440 ms |
| 1. Fix `7c9a36b` pull request | [45976766833](https://github.com/bob1525/linear-build/actions/runs/45976766833) | success. 77/77. Playwright 09:48:25Z–09:51:44Z, 46 passed, keyboard 513 ms |
| 1. Evidence `96b3749` push | [45977255503](https://github.com/bob1525/linear-build/actions/runs/45977255503) | success. 77/77 (09:51:59Z–09:52:33Z). Playwright 09:51:59Z–09:54:26Z, 46 passed, keyboard 529 ms |
| 1. Evidence `96b3749` pull request | [45977266710](https://github.com/bob1525/linear-build/actions/runs/45977266710) | success. 77/77 (09:52:04Z–09:52:29Z). Playwright 09:52:04Z–09:54:44Z, 46 passed, keyboard 576 ms |
| 2. Limits `cb3bd03` push | [45978699980](https://github.com/bob1525/linear-build/actions/runs/45978699980) | success. 83/83 (10:02:28Z–10:03:01Z). Playwright 10:02:29Z–10:04:45Z, 46 passed, keyboard 449 ms |
| 2. Limits `cb3bd03` pull request | [45978709977](https://github.com/bob1525/linear-build/actions/runs/45978709977) | success. 83/83 (10:02:33Z–10:03:05Z). Playwright 10:02:33Z–10:05:06Z, 46 passed, keyboard 481 ms |
| 2. Evidence `31a7802` push | [45979111081](https://github.com/bob1525/linear-build/actions/runs/45979111081) | success. 83/83 (10:05:23Z–10:06:03Z). Playwright 10:05:22Z–10:07:49Z, 46 passed, keyboard 470 ms |
| 2. Evidence `31a7802` pull request | [45979123782](https://github.com/bob1525/linear-build/actions/runs/45979123782) | success. 83/83 (10:05:27Z–10:06:00Z). Playwright 10:05:27Z–10:07:59Z, 46 passed, keyboard 496 ms |
| 3. Migrations `ec6c5c7` push | [45980715722](https://github.com/bob1525/linear-build/actions/runs/45980715722) | success. 87/87 (10:16:38Z–10:17:26Z). Playwright 10:16:39Z–10:19:24Z, 46 passed, keyboard 516 ms |
| 3. Migrations `ec6c5c7` pull request | [45980725676](https://github.com/bob1525/linear-build/actions/runs/45980725676) | success. 87/87 (10:16:42Z–10:17:48Z). Playwright 10:16:42Z–10:19:30Z, 46 passed, keyboard 518 ms |
| 3. Evidence `47f9621` push | [45981174220](https://github.com/bob1525/linear-build/actions/runs/45981174220) | success. 87/87 (10:19:52Z–10:20:41Z). Playwright 10:19:52Z–10:22:24Z, 46 passed, keyboard 513 ms |
| 3. Evidence `47f9621` pull request | [45981185603](https://github.com/bob1525/linear-build/actions/runs/45981185603) | success. 87/87 (10:19:57Z–10:20:56Z). Playwright 10:19:57Z–10:22:39Z, 46 passed, keyboard 513 ms |
| 4. Window `7bfd0b9` push | [45984590333](https://github.com/bob1525/linear-build/actions/runs/45984590333) | success. 95/95 (10:44:11Z–10:45:12Z). Playwright 10:44:11Z–10:46:58Z, 47 passed, keyboard 498 ms |
| 4. Window `7bfd0b9` pull request | [45984602592](https://github.com/bob1525/linear-build/actions/runs/45984602592) | success. 95/95 (10:44:16Z–10:45:21Z). Playwright 10:44:16Z–10:46:52Z, 47 passed, keyboard 433 ms |
| 4. Performance `7bfd0b9` | [45984602682](https://github.com/bob1525/linear-build/actions/runs/45984602682) | success. Board-load median **471 ms**, `budgetMs=1200` `status=ok`. Backlog mounted 9 at the top and 9 at the end |
| 4. Evidence `4e3b3a4` push | [45985058141](https://github.com/bob1525/linear-build/actions/runs/45985058141) | success. 95/95 (10:47:30Z–10:48:34Z). Playwright 10:47:30Z–10:49:55Z, 47 passed, keyboard 448 ms |
| 4. Evidence `4e3b3a4` pull request | [45985064570](https://github.com/bob1525/linear-build/actions/runs/45985064570) | success. 95/95 (10:47:33Z–10:48:16Z). Playwright 10:47:33Z–10:50:13Z, 47 passed, keyboard 489 ms |

The Actions run for this audit commit is in the next section.

## Remaining limitations

- There is no email verification and no password reset. The seed password is still `demo1234`. `NORTHSTAR_SHOW_DEMO=1` shows Fill demo again. `docs/screenshots/login.png` was captured while that block was visible.
- SQLite is one writer. One `next start` process is the deploy that matches this file. Several processes, or a serverless host, will not share it. The SQL in `prisma/migrations` does not run on Postgres. A multi-instance database would need a new provider, a new `DATABASE_URL`, and a new migration history.
- The list view still mounts every row. A board column under 10 cards also stays fully mounted. A card outside a windowed column is not in the tab order. A card taller than the 160px estimate is too low in the list until it has been measured.
- Classic branch protection on `main` returned 403 to this token on 2026-11-27, and the ruleset list was empty. An admin still has to require `Lint, typecheck, and unit tests` and `Playwright`. Do not require `Board load`. CI runs on push and pull request, so each of those names appears twice.
- `TRUST_PROXY` defaults to off. Forwarded address headers are ignored, and every caller shares `local`. Set it to `1` only when the proxy replaces those headers. If the proxy forwards the client's own header, the client can still choose an address. Successful sign-ins are not limited. Eight failed passwords per email still run bcrypt. A parallel burst can pass the check before either insert lands.
- Back up a file that has real rows before `npm run db:migrate`. The drift check runs after the history is recorded. If it fails, restore the backup. A file missing a baseline table is left alone. `npm run db:push` still does not record history. `npm run db:setup` still reseeds, so do not point it at a production file.
- `Board load` warns above 1200 ms and does not fail. Drag frame gap is recorded only. On the hosted run for `7bfd0b9` the median was 471 ms and the frame gap stayed at one frame.
- `the later saver of an issue gets a conflict prompt` can fail once. On the pull request run for this audit, Reload left the title as the other user's title joined to the title this page had loaded (`… marcus` + `… original`). That value stayed for the whole 10 second timeout. The CI retry passed, and the push run of the same commit did not flake. The same joined title showed up once locally during the board-window work, after two drag timeouts, and the next full run passed. Reload bumps a counter and calls `router.refresh()` while `issue.title` is still the old prop, so `TitleEditor` writes that stale title and then the refreshed title. A field marked dirty ignores the later server title. The assertion was not changed. A green Playwright job that reports only this flake is that race. A red Playwright job is not a pass.

## Actions run

Push of `f62b366` (the audit and the README index): [45986004157](https://github.com/bob1525/linear-build/actions/runs/45986004157), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:54:22Z to 10:55:30Z. **95 passed**.
- `Playwright`: 2026-11-27 10:54:21Z to 10:56:54Z. **47 passed** (1.3 minutes). No flaky test. The keyboard test passed on the first attempt (515 ms).

Pull request of `f62b366`: [45986012092](https://github.com/bob1525/linear-build/actions/runs/45986012092), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:54:25Z to 10:55:26Z. **95 passed**.
- `Playwright`: 2026-11-27 10:54:25Z to 10:57:09Z. **46 passed** and **1 flaky**. The keyboard test passed on the first attempt (498 ms). `the later saver of an issue gets a conflict prompt` failed on the first attempt, then passed on the CI retry (3.0 seconds).

Hosted Performance of `f62b366`: [45986012490](https://github.com/bob1525/linear-build/actions/runs/45986012490), conclusion success, 10:54:25Z to 10:55:56Z. Board-load median **470 ms**, `budgetMs=1200` `status=ok`. Backlog mounted 9 cards at the top and 9 at the end.
