# Drag test results

Final run on 10 Nov 2026, after the fixes below. Every case passed. Nothing was skipped or deleted.

Commands:

- `npx tsc --noEmit` — pass
- `npx next lint` — pass, no warnings
- `npm test` — **26 passed / 0 failed** (5 files)
- `npm run test:e2e` — **24 passed / 0 failed** (28.3s, Chromium, one worker). This script reseeds `prisma/e2e.db`, builds, and serves on port 3100.

The 21 unit tests and 13 end-to-end tests that already existed are included in those totals and still pass. The new tests are listed below.

## Unit: `tests/unit/kanban-collision.test.ts` (5/5)

These call `columnUnderPointer` with the column rectangles measured on the 1280×720 board, plus a scrolled layout.

| Case | Result |
| --- | --- |
| Pointer `(903, 384)` and `(990, 560)` resolve to In Progress, the column that contains the pointer | pass |
| Pointer in the lower empty area of a short column, `(890, 640)`, resolves to In Progress | pass |
| Gap at `x = 1017` stays In Progress; `x = 1018` is Done | pass |
| Scrolled boxes (Backlog `left -392`, Done `left 544`): `x = 680` is Done, `x = 300` is In Progress, `x = -100` is Backlog | pass |
| Pointer above every column, `(400, 20)`, returns null | pass |

## End-to-end: `e2e/drag.spec.ts` (11/11)

Relay (`RLY`) is the fixture: 12 Backlog cards, one Todo card, an empty In Progress column, and 8 Done cards. Each test signs in as Ava and opens `/p/RLY`. A pass means the card's link is in the expected column, exactly one article has that title, and a reload was used where noted.

| # | Test | What it checks | Result |
| --- | --- | --- | --- |
| 1 | shows a placeholder and highlights the column under the pointer | Mid-drag: Todo has `data-drop-target=true`, the drop bar is visible, the source card has `data-placeholder=true`, In Progress is not the target. After release, Relay backlog 01 is in Todo | pass |
| 2 | drops on a short column after the source column is scrolled | Backlog `scrollTop` > 80, then Relay backlog 12 drops on Todo and not on In Progress | pass |
| 3 | drops in the lower empty area of a short column after scrolling the source | Backlog scrolled to the middle, release at 82% of Todo's height. Relay backlog 11 lands in Todo | pass |
| 4 | drops on a column whose cards are scrolled | Done `scrollTop` > 40, release at 78% of the column. Relay backlog 10 lands in Done, not In Progress | pass |
| 5 | drops from a long column onto a short column | Backlog scrolled to the end, Relay backlog 09 lands in Todo | pass |
| 6 | drops into an empty column | In Progress is emptied first ("No issues"), then Relay done 01 drops into it | pass |
| 7 | drops into an empty column after the board is scrolled horizontally | In Progress emptied at 1280px, viewport then set to 1000×720, board scrolled to the end (`scrollLeft` > 80). Relay done 02 drops into the empty column | pass |
| 8 | drops on the column under the pointer after horizontal scroll | 1000×720, board at the end. Relay done 03 lands in In Progress, not Done and not Todo | pass |
| 9 | drops on a partially visible column after horizontal scroll | 1000×720, `scrollLeft` 120. The test asserts In Progress straddles the board's right edge, then Relay short todo drops onto that visible slice | pass |
| 10 | keeps two fast drags after a reload | Relay backlog 06 and 07 move to Done back to back. Both are in Done before the saves settle, both POSTs succeed, and both are still in Done after reload | pass |
| 11 | keeps a second drag of the same card after a reload | Relay backlog 05 goes to Todo, then immediately to Done. After both saves and a reload it is in Done and not in Todo | pass |

## Existing drag test (1/1)

| Test | Result |
| --- | --- |
| `e2e/issues.spec.ts` — drags a card into another column (Orbit Backlog → Todo, then the activity line "changed status from Backlog to Todo") | pass |

## Failures found while getting here

These failed on earlier runs of the same file. The assertions stayed. The causes were fixed.

1. **Empty column after horizontal scroll** (`e2e/drag.spec.ts` test 7). The test narrowed the viewport and then tried to park In Progress cards in Done. At 1000px, Done was off the board, so the helper refused the drop (`Column done is not visible enough to drop on`). The column is now emptied at the wide viewport, and only then is the board narrowed and scrolled.
2. **Horizontal drop never started** (test 8). `dragCard` set the column `scrollTop` from `article.offsetTop`. The article's `offsetParent` is `body`, so that number is a page offset, not a position inside the scroller. For Relay done 03 the scroller jumped to `scrollTop` 691 and the handle's box was `(701, 182)`, under the page header. `elementFromPoint` hit the header, no drag started, and the card stayed in Done. The helper now scrolls by the difference of `getBoundingClientRect`s and aborts if the handle is not the element under the pointer.
3. **Fast drags looked lost after reload** (tests 10 and 11). Both saves had committed (SQLite showed Relay backlog 05, 06, and 07 as `done`), but `page.reload()` ran before the second POST finished, so the reloaded HTML was stale. The tests now require both cards to be in the target column immediately, wait for both successful POSTs, and only then reload.

## Feedback and cost

The passing mid-drag assertions cover the placeholder, the target-column ring (`data-drop-target`), and the drop bar. The overlay is a separate node at 80% opacity. Those styles ride on dnd-kit's existing over-id update; the board does not store pointer coordinates in React state.
