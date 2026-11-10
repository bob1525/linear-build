# Drag drop-target bug

The board highlighted and saved the neighboring column when the pointer was inside the column the user was aiming at. Scrolling made the miss reliable. A drop near the top center of an unscrolled column often still landed correctly, which is why the original single drag test kept passing.

## Reproduction

1. Sign in as `ava@northstar.dev` / `demo1234` and open a project board. The desktop check used a 1280×720 viewport on Orbit.
2. Measured column boxes at that size, before any scroll: Backlog `left 264`, Todo `517`, In Progress `770`, Done `1023`. Each column was 241px wide and ran from `y = 122` to `y = 704`.
3. Drag a card by its left-hand handle and release with the pointer at `(903, 384)`. That point is inside In Progress (`770`–`1011`). The card body is about 260px wide, so the dragged rectangle continues past the 12px gap and overlaps Done (which starts at `1023`).
4. Observed result on the pre-fix board: the accent ring and the saved status were **Done**, not In Progress. The same miss happened for a second card dragged to the same point, with and without the source column scrolled.
5. Repeat after horizontal scroll. At an 860px-wide viewport with the board `scrollLeft` at 656, the column boxes were Backlog `-392`, Todo `-80`, In Progress `232`, Done `544`. Dragging toward the right edge also auto-scrolled the board (`scrollLeft` 280 → 696) under the pointer, so a point chosen before the scroll was no longer over the aimed column.
6. The pre-fix end-to-end drag (Backlog card released near the top center of Todo) still passed. That drop does not straddle the next column, so it never exercised the bug.

## Cause

`Board` passed `collisionDetection={closestCorners}` (`src/components/board.tsx` before this change). `closestCorners` (`@dnd-kit/core` `core.esm.js` around line 362) averages the distances between the corners of the **dragged rectangle** and the corners of each droppable. It never looks at the pointer.

The droppable is the full-height column `<section>`. The inner list (`overflow-y-auto`) is a child of that section, so scrolling the cards does not move the column's hit box. Vertical scroll still changes the bug in two ways: a long column forces the gesture to start on a card low in the viewport, and once the card is beside a tall column the vertical corner distances stop separating the columns. The decision collapses to horizontal overlap. The handle sits on the left of the card, so the pointer can be inside column N while most of the card rectangle covers column N+1.

The library then biases that rectangle further to the right. While a `DragOverlay` is mounted, `draggingNodeRect` is the overlay rect from `getClientRect` (`core.esm.js` lines 2487–2488 and 602–635), which **includes** the CSS transform. The collision rect is `getAdjustedRect(draggingNodeRect, modifiedTranslate)` (line 2984), which adds `modifiedTranslate` again. On a close call that extra shift is enough to prefer the next column even when a one-time measurement of the visible overlay still leans toward the column under the pointer. This document does not claim the internal collision rect was logged; the pointer, the column boxes, and the chosen column were.

Horizontal scroll moves those column boxes. Droppable rects are `Rect` instances (lines 971–996) that shift by the scroll delta of scrollable ancestors since they were measured. `closestCorners` still scores the card rectangle against those boxes, so a scrolled layout keeps the same straddling error, and the default auto-scroll can move the board again during the gesture.

A second, independent failure showed up on fast repeats. The old `onDragEnd` applied the optimistic status inside `startTransition`, then called `router.refresh()`. The effect on `issues` did `setItems(issues)` and threw away any newer optimistic status. Two overlapping transitions were not ordered, so an earlier save could finish last and put the card back.

The source card also applied `CSS.Translate` inside the scrolling column (`src/components/issue-card.tsx`), so the in-column copy moved with the pointer and shifted layout underneath the overlay.

## Fix

- `src/lib/kanban-collision.ts` — `kanbanCollision` uses `pointerWithin` (the pointer, in viewport coordinates). If the pointer is in the gap between columns, `columnUnderPointer` picks the nearest column center on that row. `tests/unit/kanban-collision.test.ts` locks the measured boxes above, including the scrolled boxes with a negative `left`.
- `src/components/board.tsx` — the board uses `kanbanCollision`. Auto-scroll only starts in the outer 12% of a scroll container, and only in the direction the pointer is already moving. The source card is not translated; it stays as the placeholder. Saves are queued on one promise chain with a per-issue ticket, and `router.refresh()` waits until the pointer is up and no save for that board is still in flight. A refresh that arrives early is reapplied with any still-pending status.
- `src/components/issue-card.tsx` — the dragged card keeps its layout box and renders as a dashed, 50% opacity placeholder. The overlay is a separate 260px card at 80% opacity with a light shadow. No per-pointer React state: the column ring and the drop bar follow dnd-kit's `isOver`, which changes when the pointer enters a column.

## Code map

| Role | Location |
| --- | --- |
| Pre-fix collision, refresh, and column scroller | `src/components/board.tsx` (committed version: `closestCorners`, `startTransition`, inner `overflow-y-auto`) |
| Pre-fix translated source card | `src/components/issue-card.tsx` (`CSS.Translate`, `opacity-40`) |
| Rectangle scoring, pointer hit test, overlay measure, collision rect, scroll-adjusted rects | `node_modules/@dnd-kit/core/dist/core.esm.js` lines 362, 472–513, 602–635, 971–996, 2487–2488, 2984 |
| Pointer collision and gap fallback | `src/lib/kanban-collision.ts` |
| Placeholder, overlay, serialized saves | `src/components/board.tsx`, `src/components/issue-card.tsx` |
