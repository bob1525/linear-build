# Performance automation

## What was done

The 500-issue measurement is now one command, `npm run perf` (`scripts/run-perf.ts`).

- It rebuilds `prisma/perf.db` with the existing `db:perf` seed (500 issues, project `PERF`), runs `next build`, starts `next start` on http://127.0.0.1:3200, runs `scripts/measure-perf.ts`, and stops the server.
- The script still loads the board three times, times the keyword filter and the High filter, and drags two cards. The JSON now includes the OS, CPU model, core count, memory, Node version, and `RUNNER_OS` / `RUNNER_ARCH` / `RUNNER_NAME` when Actions provides them.
- The board-load median is compared with 2000 ms. Under the budget the log says `status=ok`. At or above it the log says `status=warn` and emits a GitHub `::warning::` annotation. Either way the process exits 0. `PERF_BOARD_LOAD_BUDGET_MS` can change the budget. A seed, build, or measurement failure still exits non-zero.
- `.github/workflows/perf.yml` runs that command on pull requests and on manual dispatch, on `ubuntu-latest` with Node 22 and Chromium. It is separate from the required lint, unit, and Playwright workflow.

`PERFORMANCE.md` now has the reproduction command, the machine for the command run, and the automation. The Stage 5 tables are unchanged.

## Verification method

1. `npx tsc --noEmit` and `npm run lint`.
2. `npm test`.
3. `npm run perf` with the default 2000 ms budget.
4. `PERF_BOARD_LOAD_BUDGET_MS=1 npm run perf` to force the warning and confirm exit 0.
5. Push the workflow and read the Performance workflow log for the board-load median, the `status=` line, and the job conclusion.

## Evidence

Local command, 2026-11-10, Linux 6.12.113+ x64, Node v22.23.4, Intel Xeon, 4 cores, 16003 MB:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npm test` | **71/71** |
| `npm run perf` | Exit 0. 500 issues. Board-load samples 551, 438, 490 ms. Median **490 ms**. `status=ok` against 2000 ms. Keyword median 268 ms (1 issue). Priority median 137 ms (100 issues) |
| Budget forced to 1 ms | Exit 0. Median 505 ms. `status=warn` and `::warning title=Board load::Board load median 505 ms is not under 1 ms.` |

## Problems found

The Stage 5 tables did not name the machine. The command prints it now, and the command run above records this agent. No measurement failed. The warning path does not fail the process.

On the hosted runner the first drag's longest frame gap was 50 ms (p50 still 16.7 ms). The check only budgets board load, and that median was 587 ms, so the job stayed green.

## Actions run

[42848735418](https://github.com/bob1525/linear-build/actions/runs/42848735418) (`pull_request`, head `6371a65`, created 2026-11-10T15:51:27Z, finished 2026-11-10T15:53:03Z). Workflow conclusion: **success**. The Board load job succeeded (15:51:30Z–15:53:02Z).

Runner: `ubuntu-latest`, Linux 7.0.0-1019-azure x64, Node v22.23.4, AMD EPYC 7763, 4 cores, 15983 MB, `RUNNER_OS=Linux`, `RUNNER_ARCH=X64`.

| Measurement | Samples | Median |
| --- | --- | ---: |
| Board load | 668, 555, 587 ms | **587 ms** |
| Keyword filter | 357, 338, 335 ms | 338 ms |
| Priority filter | 269, 184, 287 ms | 269 ms |

500 issues on every board load. Keyword filter showed 1 issue. Priority filter showed 100. Log line: `PERF boardLoadMedianMs=587 budgetMs=2000 status=ok`. No `::warning::` for the budget.

The required CI workflow on the same commit also succeeded: push [42848722881](https://github.com/bob1525/linear-build/actions/runs/42848722881) (unit 15:51:26Z–15:51:59Z, Playwright 15:51:26Z–15:53:53Z) and pull request [42848735255](https://github.com/bob1525/linear-build/actions/runs/42848735255) (unit 15:51:32Z–15:52:07Z, Playwright 15:51:31Z–15:53:59Z).

The command, the workflow, and this note are committed on `cursor/linear-issue-tracker-ef1d`.
