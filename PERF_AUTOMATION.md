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

The Actions run is recorded in the next section after the workflow finishes.

## Problems found

The Stage 5 tables did not name the machine. The command prints it now, and the command run above records this agent. No measurement failed. The warning path does not fail the process.

## Actions run

Pending the first Performance workflow on this branch.
