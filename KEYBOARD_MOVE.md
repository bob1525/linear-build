# Keyboard card move

A focused board card can move to the neighboring column from the keyboard. Pointer drag still changes status the same way, and plain arrow keys still move focus. No existing test was deleted or weakened.

## What was done

Alt plus the left or right arrow changes the focused card’s status to the previous or next column. The save is the same `updateIssueAction` a drop uses, including the pending ticket, the conflict prompt, and the pin that keeps a just-moved card mounted. Focus follows the card. A live status names the column, or says the card is already in the first or last column.

Plain arrows, Home, and End are unchanged. Extra modifiers are ignored, and an open menu still owns the keyboard.

Issues have no manual rank. A pointer drop does not reorder a column either. The card stays where the current sort puts it.

## Baseline before the change

2026-11-27, on `653ad17`, before this change.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npx tsc --noEmit` | Pass |
| `npm test` | **114/114** (16 files) |
| `npm run test:e2e` | **56 passed** (1.4 minutes). The conflict test passed on the first attempt (5.5 seconds). The keyboard test passed on the first attempt (420 ms). No flaky test |

## Verification after the change

Same day.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. The `next lint` deprecation notice is not a failure |
| `npx tsc --noEmit` | Pass |
| `npm test` | **118/118** (17 files). Four new tests in `tests/unit/keyboard-move.test.ts`. The previous 114 still pass |
| `npm run test:e2e` | **58 passed** (1.4 minutes). Two new tests in `e2e/keyboard-move.spec.ts`. The move test passed on the first attempt (2.1 seconds). The Backlog edge passed on the first attempt (776 ms). The conflict test passed on the first attempt (2.9 seconds). The keyboard test passed on the first attempt (398 ms). No flaky test |

The drag specs in that full run passed on the first attempt, including the empty-column drop (1.3 seconds) and the Orbit drag (2.0 seconds). The board arrow-key test passed on the first attempt (556 ms).

## Problems found

The first end-to-end run of the new spec failed before it checked the move. It expected the seeded “Relay short todo” card to still be in Todo, and the edge test expected “Relay backlog 01” to still be in Backlog. Those cards had already been dragged by `e2e/drag.spec.ts` earlier in the same run. The move status for that edge press was “RLY-1 moved to Backlog”, which is a card that was no longer in Backlog. The assertions now use a card the test inserts. No product code changed for that failure. The rerun of the spec passed (2.0 seconds and 503 ms), and the full run above passed.

## Remaining limitations

- A column still has no stored order. Alt and an arrow change status only.
- The list already changes status from its menu. This shortcut is on the board.
- The drag handle is still pointer-only. The keyboard path does not show the drag overlay.

## Actions run

Recorded after the workflow for this commit finishes.
