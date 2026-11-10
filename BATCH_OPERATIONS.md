# Batch operations

A batch edits several issues in the project you are looking at. The selection is the issues on the current board or list, which is already the filtered set. A saved view restores that filter, so Select all inside the view cannot reach issues the view hides.

## Selection

Shift-click selects the inclusive range between the anchor and the issue you clicked, in the order on screen. On the board that order is Backlog, Todo, In Progress, Done, and the active sort inside each column. On the list it is the same sort. Ctrl-click or Cmd-click toggles one issue and moves the anchor. Shift combined with Ctrl or Cmd adds the range to what is already selected. Select all takes every visible issue, and the same control clears that selection when all of them are already selected. A plain click on a title still opens the issue.

The rules live in `selectionFromPointer` and `selectAll` in `src/lib/batch.ts`. They return a new selection and leave the previous one unchanged.

## Operations

The toolbar appears once something is selected:

| Action | Effect |
| --- | --- |
| Status | Sets the same workflow status on each selected issue |
| Assignee | Assigns a member, or clears the assignee |
| Add label | Adds one project label, leaving the issue's other labels |
| Remove label | Removes one project label |
| Delete | Asks for confirmation, then deletes. Cancel leaves the issues in place |

`planBatch` decides the outcome before any write. An id that is not in the project fails with "Issue not found" and the others still run. An assignee or label that is not in the project fails every selected issue with that reason, and nothing is written. Duplicate ids are handled once. Each accepted issue is then written in its own transaction, with the same activity entry a single edit would record. A write that throws is recorded as a failure for that issue only.

The bar shows "Updating N issues…" or "Deleting N issues…" while the request is in flight. It then shows `Updated · 2 succeeded, 0 failed` (or Deleted), the keys that succeeded, and one line per failure: `ORB-4: Issue not found` or `Unknown issue: Issue not found` when the issue was already gone. Succeeded issues leave the selection. Failed ones stay selected.

## Tests

| Check | Result |
| --- | --- |
| `tsc --noEmit` | pass |
| `next lint` | pass |
| Vitest | 65/65 |
| Playwright | 36/36 |

Unit tests in `tests/unit/batch.test.ts`:

| Test | What it checks |
| --- | --- |
| plans a status change for every selected issue and does not mutate them | Status plan, summary text, and a non-mutating apply |
| reports a missing issue and still updates the ones that exist | Partial status result, duplicate id ignored |
| rejects an invalid status without marking those issues updated | Invalid status fails the known issues; a missing id fails separately |
| rejects an assignee who is not a member and allows unassigning | Bad assignee fails the batch; unassign is allowed |
| adds and removes a project label without changing the original issue | Label add, remove, and an unknown label |
| treats delete as success for issues that exist and failure for the rest | Delete plan |
| toggles with a plain or modified click | Ctrl/Cmd toggle and an unknown id |
| shift-click selects the inclusive range and shift-cmd adds it | Range replace and additive range |
| selects every visible id and can clear back to empty | Select all |

Playwright, `e2e/batch.spec.ts`:

| Test | What it checks |
| --- | --- |
| shift and ctrl click select issues, then a batch status change updates only those | Range select, ctrl toggle, status change, the untouched issue stays Todo |
| shows which issue failed when part of a batch no longer exists | One deleted issue fails, the other becomes Done, the result names both |
| a filtered saved view batches only the issues in that view | Select all inside a keyword view, status change, an issue outside the view stays put, reload keeps the view |
| asks for confirmation before deleting the selection | Cancel keeps the issue; confirm deletes it and reports success |

The earlier 56 unit tests and 32 Playwright tests still pass in the same runs.
