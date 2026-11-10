# Performance

Measured against a production build (`next start`) and a separate SQLite file. The demo seed is still 67 issues. This dataset is project `PERF`: 500 issues, 125 in each status, priorities cycling through none, low, medium, high, and urgent (100 high). Titles are `Perf 001` through `Perf 500`.

## How to reproduce

Install Chromium once (`npx playwright install chromium`), then:

```bash
npm run perf
```

That command rebuilds `prisma/perf.db`, runs `next build`, starts the app on http://127.0.0.1:3200, runs `scripts/measure-perf.ts`, and stops the server. It does not replace the demo database. The script signs in as `perf@northstar.dev`, loads `/p/PERF?all=1` three times, times the keyword and High filters, and drags two cards. The printed JSON includes the machine: OS, CPU model, core count, memory, Node version, and the GitHub-hosted runner name when Actions sets it.

`PERF_PORT` changes the port (default 3200). `PERF_BOARD_LOAD_BUDGET_MS` changes the warning line (default 1200). A board-load median under that budget prints `status=ok`. A median that is not under it prints `status=warn` and a `::warning::` line, and the command still exits 0. The same line prints `dragFrameP50Ms` and `dragFrameMaxMs` for the two drags. Those numbers are recorded only. They are not compared with a budget and they do not warn.

The 1200 ms budget is about twice the measured board-load median. Local and hosted runs of this 500-issue board land around 490–587 ms, and the slowest sample in those runs was 668 ms. The previous 2000 ms line was more than three times the median, so a load that doubled would still have been `status=ok`. 1200 ms sits above that observed range and will warn if the median moves that far. It still does not fail the job.

## Automation

`.github/workflows/perf.yml` runs `npm run perf` on pull requests and on manual dispatch. The job is the 500-issue measurement, not the unit or end-to-end suite. Crossing the 1200 ms board-load budget logs a warning and leaves the job green. The workflow sets `PERF_BOARD_LOAD_BUDGET_MS` to that same value. A failed seed, build, or measurement fails the job. Drag frame gap is printed and is not a warning.

The first run is [42848735418](https://github.com/bob1525/linear-build/actions/runs/42848735418) (`pull_request`, `6371a65`, 2026-11-10). `ubuntu-latest`, Linux 7.0.0-1019-azure x64, Node v22.23.4, AMD EPYC 7763, 4 cores, 15983 MB. Board-load samples 668, 555, and 587 ms, median **587 ms**, `status=ok` against 2000 ms. Keyword median 338 ms. Priority median 269 ms. The job succeeded.

## Command run on this agent

`npm run perf` on 2026-11-10, before the Actions run. Linux 6.12.113+ x64, Node v22.23.4, Intel Xeon, 4 cores, 16003 MB. GitHub runner fields were empty because this was not Actions. The board still showed 500 issues. Board-load samples were 551, 438, and 490 ms.

| Measurement | Median |
| --- | ---: |
| Board load | 490 ms |
| Keyword filter (`Perf 250`, 1 issue, includes the 200 ms debounce) | 268 ms |
| Priority filter (High, 100 issues) | 137 ms |

Both drags stayed at a 16.7 ms median frame gap and were in Done within 19 ms of release. The summary line was `PERF boardLoadMedianMs=490 budgetMs=2000 status=ok`.

A second run with `PERF_BOARD_LOAD_BUDGET_MS=1` printed `status=warn` and `::warning title=Board load::Board load median 505 ms is not under 1 ms.` The process exited 0.

## Recorded run

The tables below are the Stage 5 measurement. That run did not record CPU or memory. Viewport 1440×900, Chromium. Each figure is from that run.

## Board load

Wall clock is navigation to `/p/PERF?all=1` until the Todo heading and `Perf 002` are visible. `loadEventEnd` is the document's own timing. Every run counted 500 issues on the board.

| Run | Wall clock | DOMContentLoaded | loadEventEnd | Transfer |
| --- | ---: | ---: | ---: | ---: |
| 1 | 507 ms | 115 ms | 116 ms | 45,072 bytes |
| 2 | 528 ms | 126 ms | 127 ms | 45,071 bytes |
| 3 | 445 ms | 115 ms | 115 ms | 45,071 bytes |

Median wall clock: **507 ms**.

## Filter response

Keyword search fills `Perf 250` and waits until that card is the one on screen. The field waits 200 ms before it writes the query, so the wall clock includes the debounce. Each run showed 1 issue.

| Run | Wall clock |
| --- | ---: |
| 1 | 301 ms |
| 2 | 299 ms |
| 3 | 286 ms |

Median: **299 ms**. About 100 ms of that is after the debounce.

Priority filter clicks High and waits until the URL contains `priority=high` and `Perf 004` is visible. Each run showed 100 issues, which is the high-priority count in the dataset.

| Run | Wall clock |
| --- | ---: |
| 1 | 153 ms |
| 2 | 151 ms |
| 3 | 147 ms |

Median: **151 ms**.

## Drag

`Perf 002` and then `Perf 006` were dragged from Todo to Done, 24 pointer steps each. Frame gaps come from `requestAnimationFrame` during the gesture. Settle is pointer-up until the card is in Done.

| Card | Gesture | Settle | Frames | p50 gap | p95 gap | max gap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Perf 002 | 564 ms | 27 ms | 38 | 16.7 ms | 33.3 ms | 33.4 ms |
| Perf 006 | 534 ms | 26 ms | 38 | 16.7 ms | 16.8 ms | 16.8 ms |

16.7 ms is one frame at 60 Hz. The first drag dropped a single frame. Both cards were in Done within 27 ms of release.

The repeatable command measures the same three board loads, three keyword filters, three priority filters, and two drags. Compare a new JSON report with the medians above: board load 507 ms, keyword filter 299 ms, priority filter 151 ms.

## What was changed

A card body does not re-render when its issue, selection, and drag placeholder are unchanged, so the other cards' contents stay put while one card is dragged. Column hit testing still looks at the four columns. These timings are from that build. The board is on screen in about half a second, both filters return in well under a second, and the drag stays on a 60 Hz frame, so the columns were not virtualized.
