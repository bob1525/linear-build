# Performance threshold

## What was done

The board-load warning budget is now 1200 ms. It was 2000 ms.

Measured medians for the 500-issue board are about 500–600 ms: 490 ms on this agent during the automation stage, 587 ms on the first hosted run, and 509 ms on the following hosted run. The slowest sample in those runs was 668 ms. 1200 ms is about twice that median and still above every sample so far. 2000 ms was more than three times the median, so a load that doubled would still have printed `status=ok`. 1500 ms would still pass a median near 1200 ms, which is already about twice the measured result. 1200 ms is the tighter of the two figures that stays clear of the observed range.

The budget is the default in `scripts/measure-perf.ts` and the `PERF_BOARD_LOAD_BUDGET_MS` value in `.github/workflows/perf.yml`. Under 1200 ms the log says `status=ok`. At or above it the log says `status=warn` and emits `::warning::`. The process still exits 0. A seed, build, or measurement failure still exits non-zero.

The summary line also prints `dragFrameP50Ms` and `dragFrameMaxMs` for the two drags. Those numbers are not compared with a budget. They do not emit a warning and they do not change the exit code. The JSON already contained the per-drag frame stats. This puts the same figures on the line that the workflow log is scanned for.

`README.md` and `PERFORMANCE.md` name the 1200 ms budget. The older tables still say they were judged against 2000 ms, because that was the budget on those runs.

## Verification method

1. `npm run lint`, `npx tsc --noEmit`, and `npm test`.
2. `npm run perf` with the new default, and read `budgetMs`, `status`, and the drag frame fields.
3. Start that same production build with `prisma/perf.db` and run `scripts/measure-perf.ts` with `PERF_BOARD_LOAD_BUDGET_MS=1`. Confirm `status=warn`, the board-load `::warning::`, the drag figures on the same line, and exit 0.
4. After the push, read the Performance workflow for this commit: median, budget, status, drag frame figures, and the job conclusion.

No test was edited.

## Evidence

Local, 2026-11-10, Linux 6.12.113+ x64, Node v22.23.4, Intel Xeon, 4 cores, 16003 MB.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **71/71** |
| `npm run perf` | Exit 0. 500 issues. Board-load samples 470, 526, 489 ms. Median **489 ms**. `budgetMs=1200` `status=ok`. `dragFrameP50Ms=16.7,16.7` `dragFrameMaxMs=16.7,16.8`. Keyword median 272 ms. Priority median 124 ms |
| Budget forced to 1 ms | Exit 0. Median 473 ms. `status=warn`. `::warning title=Board load::Board load median 473 ms is not under 1 ms.` Drag figures still printed (`dragFrameP50Ms=16.7,16.7` `dragFrameMaxMs=16.8,16.8`). No warning was emitted for the frame gap |

## Problems found

The warning path still exits 0, which is the same contract as the 2000 ms gate. One earlier hosted drag had a 50 ms frame max while the board-load median stayed at 587 ms. That is why the frame gap is recorded and is not a warning.

On push CI [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385), `opens the new issue dialog from the keyboard` failed once and passed on the retry Playwright already allows in CI (`retries: 1`). The first attempt pressed `c` and the New issue dialog was not visible within 10 seconds. The listener is a `window` keydown effect in `src/components/shell.tsx`, and the test does not wait for that effect before pressing the key. This budget change does not touch that test or the shell. The retry was not added or skipped for this run.

The `pull_request` event for `9e5102f` did not create a Performance run, or a second CI run. The push workflow did run.

## Actions run

Push CI for `9e5102f`: [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385). Workflow conclusion: **success**. Lint, typecheck, and unit tests succeeded (16:58:18Z–16:59:24Z, Vitest **71/71**). Playwright succeeded (16:58:17Z–17:01:31Z) with `1 flaky` and `43 passed`.

The Performance run for the follow-up commit is recorded here once it finishes.
