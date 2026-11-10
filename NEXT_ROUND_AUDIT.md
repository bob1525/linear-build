# Next round audit

This round followed the finishing-round audit. It fixed the duplicate board screenshot and the conflict-dialog toast, tightened the board-load warning, hid the demo sign-in hint in production, added in-memory rate limits, and wrote the merge checklist. No test was deleted or weakened. The pull request was not merged, and repository settings were not changed.

## The four stages

| Stage | What changed | Self-check |
| --- | --- | --- |
| 1. Screenshots | `board-with-relations.png` is a crop of the Todo column (ORB-3 Blocks, ORB-2 Blocked) instead of a byte copy of `board.png`. `conflict-dialog.png` is taken after the create toast leaves. | [SCREENSHOTS_FIX.md](SCREENSHOTS_FIX.md) |
| 2. Performance gate | The board-load warning is 1200 ms, in the script and in `.github/workflows/perf.yml`. A miss still exits 0. The summary line records `dragFrameP50Ms` and `dragFrameMaxMs` and does not warn on them. | [PERF_THRESHOLD.md](PERF_THRESHOLD.md) |
| 3. Demo auth | Production hides Fill demo unless `NORTHSTAR_SHOW_DEMO=1`. The end-to-end server sets that flag so the existing hint test still runs. Failed sign-ins and valid registrations are counted in this process. | [AUTH_HARDENING.md](AUTH_HARDENING.md) |
| 4. Merge readiness | Require the check names `Lint, typecheck, and unit tests` and `Playwright`. Do not require `Board load`. The merge steps for PR #1 include the keyboard-dialog flake. | [MERGE_READINESS.md](MERGE_READINESS.md) |

## Tests

This round added **6** unit tests (`tests/unit/auth-hardening.test.ts`) and **2** end-to-end tests (bad-password lockout and repeated registration). The count going in was 71 unit tests and 44 end-to-end tests. It is now **77** unit tests and **46** end-to-end tests. The original tests are still in the suite, including `demo hint matches the documented password` and `opens the new issue dialog from the keyboard`.

### Local rerun for this audit

2026-11-10, Node v22.23.4, before this file was committed:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **77/77** |
| `npm run test:e2e` | **46 passed** (1.3 minutes), including both mobile tests, the two new auth tests, and the keyboard-dialog test |

### CI runs from this round

| Stage | Run | Result |
| --- | --- | --- |
| 1. Screenshot fix `6527d39` | [42858462657](https://github.com/bob1525/linear-build/actions/runs/42858462657) | success. 71/71 and 44 passed |
| 1. Evidence `f6f968d` | [42859078038](https://github.com/bob1525/linear-build/actions/runs/42859078038) | success. 71/71 and 44 passed |
| 2. Budget commit `9e5102f` | [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385) | success. 71/71. Playwright `1 flaky` and `43 passed` (the keyboard test, below) |
| 2. Hosted measurement `7fd8926` | [42860934498](https://github.com/bob1525/linear-build/actions/runs/42860934498) | success. Board-load samples 582, 578, 587 ms, median **582 ms**, `budgetMs=1200` `status=ok`, `dragFrameMaxMs=49.9,50` |
| 2. Evidence `ac40893` | [42861456974](https://github.com/bob1525/linear-build/actions/runs/42861456974) | success. 71/71 and 44 passed, no flake |
| 3. Auth `8c483c5` | [42863142256](https://github.com/bob1525/linear-build/actions/runs/42863142256) | success. **77/77** and **46 passed**, no flake |
| 3. Evidence `0917928` | [42863730820](https://github.com/bob1525/linear-build/actions/runs/42863730820) | success. 77/77 and 46 passed |
| 4. Merge note `020ce25` | [42864621185](https://github.com/bob1525/linear-build/actions/runs/42864621185) | success. 77/77 and 46 passed |
| 4. Evidence `f684060` | [42865265278](https://github.com/bob1525/linear-build/actions/runs/42865265278) | success. 77/77 and 46 passed, no flake |

The Actions run for this audit commit is in the next section.

## Remaining limitations

- SQLite is one writer. Several `next start` processes, or a serverless host, will not share the file.
- Sign-in limits live in this Node process. A restart clears them, and a second process does not see them. The client address is taken from `x-forwarded-for` or `x-real-ip`, which a caller can spoof. With neither header, everyone shares `local`. Successful sign-ins are not limited. Eight failed passwords per email still run bcrypt.
- There is no email verification and no password reset. The seed password is still `demo1234`. `NORTHSTAR_SHOW_DEMO=1` shows Fill demo again. `docs/screenshots/login.png` was captured while that block was visible.
- `Board load` warns above 1200 ms and does not fail. Drag frame gap is recorded only. On the hosted run the frame max was 50 ms while the board-load median was 582 ms.
- `opens the new issue dialog from the keyboard` can fail once. `login()` returns at the board URL, and the `c` listener is attached after hydration, so an early press does nothing. CI retries once. A green job that reports only that flake is the known race. A red Playwright job is not a pass. The test was not changed.
- Classic branch protection on `main` returned 403 to this token, and the ruleset list was empty. An admin still has to require `Lint, typecheck, and unit tests` and `Playwright`. CI runs on push and pull request, so each of those names appears twice.
- Columns are not virtualized. The measured board is 500 issues.

## Actions run

Recorded after the workflow for this commit finishes.
