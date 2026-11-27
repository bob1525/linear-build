# Board column virtualization

A 500-issue board mounted every card. Each column held about 125 cards, and scrolling could not drop any of them from the document. This stage windows a long column. Drag-and-drop, relation markers, batch selection, and the keyboard shortcuts stay as they were. No test was deleted or weakened.

## What was done

`src/lib/column-window.ts` chooses which indexes to mount. A column with fewer than 10 cards mounts all of them. That covers Orbit (at most 7 in a column) and Relay's Done column (8). Relay's Backlog has 12, and the measured project has 125 per column, so those window.

The mounted range is the scroll position, the viewport, and 2 cards of overscan. Until a card is measured it reserves 160px, which is taller than a normal card, so the scrollbar can reach the last card. After paint, the card's height replaces that estimate and the gap stays 8px (`gap-2`). The list is absolutely positioned inside a `shrink-0` box of that total height. The column element is still the dnd-kit droppable. The header count is still the full column size.

Two cards stay mounted even when they sit outside the range:

- The card being dragged, so the placeholder does not unmount and cancel the drag.
- Up to 8 cards moved in this visit. A drop sorts into the destination column, and that position can be outside the window. The existing tests look the card up in the document.

`e2e/helpers.ts` `dragCard` scrolls a column until the named card is mounted, then does the same centering and pointer move as before. If the card is already mounted, it does not change any column's scroll. `scripts/measure-perf.ts` does the same before a measured drag. Board readiness now waits for the first card in Todo and a header total of 500. The settle check waits for the card that was dragged. The summary line the workflow already scans is unchanged. A second line records how many Backlog cards were mounted at the top and after a 400ms scroll to the end.

The list view is not windowed.

## Verification

2026-11-27, Node v22.23.4, 4 cores, 16003 MB.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **95/95** (13 files). `tests/unit/column-window.test.ts` adds 8 tests. The previous 87 still pass |
| `npm run test:e2e` | **47 passed** (1.2 minutes). The new test is `mounts the visible slice of a long column and the card at the end after scrolling`. The keyboard test passed on the first attempt (405 ms). No flaky test |

`npm run perf` on the same machine, production build, 500 issues, viewport 1440×900.

Before this stage the script mounted every card and waited for the link `Perf 002`. Samples:

| Measure | Before |
| --- | --- |
| Board load | 455, 460, 501 ms. Median **460 ms**. `status=ok` |
| Mounted cards | Every issue was in the document. The script did not count them. The HTML transfer was about 45 KB |
| Keyword filter | 306, 263, 262 ms. Median **263 ms**. 1 issue shown |
| Priority filter | 132, 166, 124 ms. Median **132 ms**. 100 shown |
| Drag frame gap | `dragFrameP50Ms=16.7,16.7` `dragFrameMaxMs=16.8,16.8`. Gestures 481 ms and 455 ms |

After, the same command mounts the visible slice. `Perf 002` is deep in Todo, so readiness is the first Todo card plus the header total of 500. Both drags still move a card onto Done.

| Measure | After |
| --- | --- |
| Board load | 442, 425, 431 ms. Median **431 ms**. `budgetMs=1200` `status=ok` |
| Mounted cards | **36** on each of the three loads. HTML transfer about 29 KB |
| Backlog scroll | Header **125**. Mounted **9** at the top and **9** after scrolling to the end in 421 ms. `scrollFrameP50Ms=16.7` `scrollFrameMaxMs=16.8` |
| Keyword filter | 256, 237, 238 ms. Median **238 ms**. 1 issue shown |
| Priority filter | 105, 93, 100 ms. Median **100 ms**. 100 shown |
| Drag frame gap | `dragFrameP50Ms=16.7,16.7` `dragFrameMaxMs=16.8,16.7`. Gestures 421 ms and 417 ms. Settle 3 ms and 3 ms |

Log lines: `PERF boardLoadMedianMs=431 budgetMs=1200 status=ok dragFrameP50Ms=16.7,16.7 dragFrameMaxMs=16.8,16.7` and `PERF scrollMountedAtTop=9 scrollMountedAtEnd=9 scrollMs=421 scrollFrameP50Ms=16.7 scrollFrameMaxMs=16.8`.

The frame gap was already one frame before this stage, so it did not get smaller. The load time moved from 460 ms to 431 ms. The document went from every card to 36.

## Problems found

The first end-to-end run never reached Relay backlog 12. `scrollTop` was only a couple of cards, and the drag helper waited until the test timed out. The virtual list is a flex child. Flex shrink collapsed its explicit height to the viewport, so `scrollHeight` did not include the unmounted cards. `shrink-0` keeps that height. The window, drag, and edge files then passed, and the full `npm run test:e2e` passed 47.

On that first run, `the later saver of an issue gets a conflict prompt` also failed once. The title field showed the reloaded title concatenated with the draft. That test uses the issue page, which this stage does not render, and the drag tests ahead of it had each sat at the 60 second timeout. The same test passed on its own and in the clean full run. The assertion was not changed.

The first after-measurement crashed in the browser with `ReferenceError: __name is not defined`. The scroll script was a function the compiler rewrote, and that helper does not exist in the page. The drag timing already avoided that by passing a string to `new Function`. The scroll timing does the same now. The rerun is the table above.

## Tradeoffs

- A column under 10 cards is fully mounted. Windowing those columns would make the existing selectors miss cards that are merely scrolled out of view.
- A card outside the window is not in the tab order or the accessibility tree. The header still shows the full count. Select all still uses the filtered issue ids, not the mounted checkboxes. Relation markers render on the mounted cards. Orbit's Todo column has 6 cards, so the Blocks and Blocked markers stay mounted.
- A card taller than the 160px estimate is too low in the list until it has been measured. Scrolling through the column measures it and corrects the offsets.
- The list view still mounts every row.
- One `next start` process and the SQLite file are unchanged.

## Actions run

Recorded after the workflow for this commit finishes.
