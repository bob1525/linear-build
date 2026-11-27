# List view virtualization

The list rendered every filtered row. On the 500-issue measurement project that was 500 mounted rows and about 1.34 MB of HTML. This stage windows a long list. Filters, sorting, batch selection, the keyboard shortcuts, and opening an issue stay as they were. No existing test was deleted or weakened.

`BOARD_VIRTUALIZATION.md` says the list is not windowed. That was true for that stage.

## What was done

`columnWindow` takes an optional `minimum`. When it is omitted the floor stays 10, so the column tests and the board are unchanged. `src/lib/list-window.ts` calls it with the list's own numbers:

- Floor of 24 rows. Orbit has 20, Relay 21, Pulse 14, Atlas 12, and the filtered batch lists have 2 or 3. Those stay fully mounted, so the existing row locators still find them without scrolling.
- Row estimate 48px, taller than a one-line row, so the scrollbar can reach the last row before it is measured. The gap is 0 because rows are separated by a border.
- Overscan of 4.

`IssueList` still sorts with `compareIssues`, then asks `listWindow` which indexes to mount. The column labels stay outside the scroller. The rows are absolutely positioned in a `shrink-0` box of the total height, which is the fix the board needed when flex shrink collapsed `scrollHeight`. The scroller is `data-testid="list-scroll"` and carries `data-virtualized`, `data-rendered-count`, `data-window-end`, and `data-list-size` (the full sorted length, not the mounted slice). `overflow-anchor` is off.

Select all, shift range, and batch versions still use the ordered ids in `issue-browser.tsx`. They do not read the mounted checkboxes. The `c` and `/` shortcuts stay on the shell.

`scripts/measure-perf.ts` still prints the two board lines the workflow already scans. A third line records the list: load median, rows mounted at the top and after a jump to the end, and the HTML size. The script fails if the 500-row list mounts every row.

## Verification

2026-11-27, Node v22.23.4, 4 cores, 16003 MB.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npx tsc --noEmit` | Pass |
| `npm test` | **102/102** (15 files). `tests/unit/list-window.test.ts` adds 4 tests. The previous 98 still pass, including the 8 column-window tests |
| `npm run test:e2e` | **48 passed** (1.4 minutes). The new test is `mounts a slice of a long list, selects every row, and opens the last issue` (1.6 seconds). The conflict test passed on the first attempt (2.4 seconds). The keyboard test passed on the first attempt (426 ms). No flaky test |

Before, on the production build of `4d86640` (every row still mounted), `npm run db:perf`, then `next start` on port 3200. Playwright, viewport 1440×900, three visits to `/p/PERF/list?all=1`, counting `[data-testid^='row-']` and `documentElement.outerHTML.length`.

| Measure | Before (`4d86640`) |
| --- | --- |
| List load | 445, 463, 482 ms. Median **463 ms** |
| Mounted rows | **500** on each visit |
| HTML | 1,339,749 / 1,339,861 / 1,339,861 bytes |

After, `npm run perf` on the same machine. Production build, 500 issues, same viewport. The board summary line is unchanged in shape and still inside the budget.

| Measure | After |
| --- | --- |
| List load | 382, 376, 382 ms. Median **382 ms** |
| Mounted rows | **19** on each load. After a jump to the end, **18** mounted and `data-window-end` is 500. Scroll 39 ms |
| HTML | 348,917 / 349,029 / 349,029 bytes |
| Board load | 431, 415, 145 ms. Median **415 ms**. `budgetMs=1200` `status=ok` |
| Backlog scroll | Header **125**. Mounted **9** at the top and **9** at the end. `scrollMs=423` |

Log lines: `PERF boardLoadMedianMs=415 budgetMs=1200 status=ok dragFrameP50Ms=16.7,16.7 dragFrameMaxMs=16.8,16.7`, `PERF scrollMountedAtTop=9 scrollMountedAtEnd=9 scrollMs=423 scrollFrameP50Ms=16.6 scrollFrameMaxMs=16.8`, and `PERF listLoadMedianMs=382 listMountedAtTop=19 listMountedAtEnd=18 listScrollMs=39 listSize=500 listHtmlBytes=348917`.

The list document went from 500 rows and about 1.34 MB to 19 rows and about 349 KB. The load median moved from 463 ms to 382 ms.

## Problems found

The first run of the new end-to-end test failed its own header assertion. `getByText('Title')` matched the hidden sort `<option value="title">Title</option>`, which is not visible. The list header was on screen: the failure screenshot shows the ID, Title, Status, Labels, and Due labels, the first ten `ListWin…` rows, and "40 of 61". The locator is now the header that sits above `list-scroll`. No product code changed for that failure, and no existing assertion was edited. The spec then passed in 1.8 seconds, and the full `npm run test:e2e` passed 48.

The height box was `shrink-0` in the first cut, so this stage did not repeat the board bug where flex shrink collapsed `scrollHeight` and the last row could not be reached.

## Tradeoffs

- A list under 24 rows is fully mounted. Windowing those lists would drop Orbit and Relay rows out of the document, and the existing list, filter, relation, and batch tests would miss them. The 500-row list, and the new 40-row list, still window.
- A row outside the window is not in the tab order or the accessibility tree. The view header still shows the filtered count (`40 of 61` in the new test). Select all still reports the full filtered count, including rows that are not mounted. Status menus exist on the mounted rows.
- A row taller than the 48px estimate is too low in the list until it has been measured. The seeded rows are one line.
- The page still loads every issue for the project, and sorting and filtering still run on that full array. This stage only stops the list from mounting every row.
- One `next start` process and the SQLite file are unchanged.

## Actions run

Push of `0041bce`: [46002297279](https://github.com/bob1525/linear-build/actions/runs/46002297279), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 12:52:36Z to 12:53:44Z. **102 passed** (15 files).
- `Playwright`: 2026-11-27 12:52:36Z to 12:55:29Z. **48 passed** (1.4 minutes). `the later saver of an issue gets a conflict prompt` passed on the first attempt (2.6 seconds). The keyboard test passed on the first attempt (589 ms). `mounts a slice of a long list, selects every row, and opens the last issue` passed on the first attempt (1.7 seconds).

Pull request of the same commit: [46002307434](https://github.com/bob1525/linear-build/actions/runs/46002307434), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 12:52:41Z to 12:53:35Z. **102 passed** (15 files).
- `Playwright`: 2026-11-27 12:52:41Z to 12:55:29Z. **48 passed** (1.5 minutes). The conflict test passed on the first attempt (5.7 seconds). The keyboard test passed on the first attempt (494 ms). The long-list test passed on the first attempt (2.1 seconds).

Performance on the same commit, not required: [46002307431](https://github.com/bob1525/linear-build/actions/runs/46002307431), conclusion success (12:52:41Z to 12:53:50Z). `PERF boardLoadMedianMs=415 budgetMs=1200 status=ok dragFrameP50Ms=16.7,16.7 dragFrameMaxMs=16.8,16.8`, `PERF scrollMountedAtTop=9 scrollMountedAtEnd=9 scrollMs=427 scrollFrameP50Ms=16.7 scrollFrameMaxMs=16.8`, and `PERF listLoadMedianMs=375 listMountedAtTop=19 listMountedAtEnd=18 listScrollMs=39 listSize=500 listHtmlBytes=348916`. No board-load warning.
