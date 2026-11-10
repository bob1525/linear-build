# Issue relations and sub-issues

Stage 2 adds blocking, related, and one-level sub-issue links on the existing Northstar issue model. Orbit is seeded with one of each so the board, list, and issue page show them before anyone adds another.

## Data model

Two shapes, both scoped to a single project.

**`IssueRelation`** stores blocks and related. `type` is `blocks` or `related`.

| Direction the user picks | Row that is stored |
| --- | --- |
| A blocks B | `blocks`, from A, to B |
| A is blocked by B | `blocks`, from B, to A |
| A related to B | one `related` row, with the lexicographically smaller issue id in `fromIssueId` |

`@@unique([fromIssueId, toIssueId, type])` rejects a second copy of the same edge. Deleting an issue cascades its edges. "Blocked by" is not its own row; it is the blocks edge read from the other end.

**Sub-issues** use `Issue.parentId`. One level only: a parent is an issue whose `parentId` is null, and a child cannot have children. Removing the parent sets `parentId` back to null (`onDelete: SetNull`). The issue count stays 67. Seeded Orbit links:

- ORB-3 blocks ORB-2 (`Zephyr cache returns stale issue counts` blocks `Filter chips wrap under the view header`)
- ORB-4 is related to ORB-5
- ORB-5's parent is ORB-1

## Cycle detection

`blocksWouldCycle` walks existing `blocks` edges starting at the issue that would become blocked. The new edge is rejected when that walk reaches the blocker. That covers a direct loop (A blocks B while B blocks A) and a longer loop (A blocks B, B blocks C, C blocks A). An issue cannot block itself. Related edges are not part of the walk, so a related pair may also have one blocking direction. After the original edge is removed, the opposite block is allowed.

## API

`addIssueRelationAction` and `removeIssueRelationAction` take `{ issueId, target, kind }`. `kind` is `blocks`, `blocked_by`, `related`, or `sub_issue`. `target` is an issue key (`ORB-12`) or a bare number in the same project. Titles are rejected with `Enter an issue key like ORB-12`. The caller must be signed in and a member of the issue's project.

The pure checks live in `src/lib/relations.ts` and do not mutate the caller's list. The action loads the project's edges (or, for sub-issues, each issue's `parentId`), applies the check, then writes in a transaction:

- blocks / related: insert or `deleteMany` the normalized edge
- sub-issue: `updateMany` the child only when `parentId` is null (add) or equals this parent (remove). A count other than 1 means the row changed underneath the check
- both issues get an activity row (`relation_added` / `relation_removed`, or `subissue_added` / `subissue_removed`)

A unique-constraint race (`P2002`) returns the same duplicate message as the pure check. Paths for the board, the list, and both issue pages are revalidated.

Stable errors:

| Situation | Message |
| --- | --- |
| Same issue on both sides | Choose a different issue |
| Edge already stored, including related from the other side | That relation already exists |
| Blocking cycle | That would create a blocking cycle |
| Delete of an edge that is not there | That relation does not exist |
| Sub-issue of itself | An issue can't be a sub-issue of itself |
| Parent is already a child, or the child already has children | Sub-issues can't contain other sub-issues |
| Child already has a different parent | This issue already belongs to another issue |
| Child already has this parent | This issue is already a sub-issue of that issue |
| Sub-issue link is already gone | That sub-issue does not exist |
| Unknown issue, or caller is not a member | Issue not found |

Activity text, from `describeActivity`: "marked this issue as blocked by ORB-3", "is no longer blocked by ORB-3", "marked this issue as blocking ORB-2", "no longer blocks ORB-2", "related this issue to ORB-6", "removed the relation to ORB-6", "added ORB-6 as a sub-issue", "removed sub-issue ORB-6", "set the parent to ORB-1", "cleared the parent ORB-1".

## Frontend display

The issue page has a Relations section under the description. A select (Blocked by, Blocks, Related to, Sub-issue) and an issue-key field with a datalist of the other issues in the project submit to the add action. Each group (blocked by, blocks, related, parent, sub-issues) lists the linked issue and a Remove button, or the word None. The parent row removes the link by calling the action with the parent as the current issue and this issue as the target.

The list and the new activity line update as soon as the action returns. A later refresh keeps whichever copy the server rendered. Board cards and list rows set `data-blocked` / `data-blocks` and show an amber **Blocked** mark, a **Blocks** mark, or both. Counts come from one `blocks` query for the project, not a query per card. Marks sit beside the issue key on a card so the card's accessible name stays the title.

## Test coverage

Unit tests in `tests/unit/relations.test.ts` are pure (no database). They cover create, query, and delete for blocks, blocked-by, and related; duplicate and self rejection; a direct cycle and a three-issue cycle; deleting from the other side; query isolation; a related pair that also blocks; issue-key parsing; and the one-level sub-issue rules (add, query, remove, grandchild, second parent, self, missing).

| Check | Result |
| --- | --- |
| `tsc --noEmit` | pass |
| `next lint` | pass |
| Vitest | 45/45 (18 relation, 4 activity, 7 filters, 4 validators, 7 issue-view, 5 kanban) |
| Playwright | 29/29 |

Relation end-to-end tests, in `e2e/relations.spec.ts`, run last because they change Orbit:

| Test | What it checks |
| --- | --- |
| shows blocking relations on the issue, the board, and the list | ORB-2 is Blocked, ORB-3 Blocks, on the card, the row, and the issue page |
| adds a related issue, keeps it after reload, and rejects a duplicate | ORB-4 gains ORB-6, the activity line appears, reload keeps ORB-5 and ORB-6, a second add shows the duplicate error |
| rejects a blocking cycle from the issue page | ORB-7 blocks ORB-8, then ORB-8 cannot block ORB-7, and ORB-8's Blocks list stays None |
| removes a blocked-by relation and clears the board marker | Removing ORB-3 from ORB-2 clears the list, records the activity, and drops both board marks |
| shows, adds, and removes one level of sub-issues | ORB-5's parent is ORB-1, ORB-1 gains ORB-6, reload still shows the activity, ORB-6 cannot parent ORB-9, removing ORB-6 leaves ORB-5 |

The original 24 Playwright tests and the 26 earlier unit tests are unchanged and pass in the same runs. One original keyboard test (`/` focuses search) failed when the board route was still on its loading skeleton: the shell was already listening, and the search field had not mounted, so the shortcut found nothing. `/` now retries until that field is in the document (about 2.5 seconds), and stops early if focus has moved into a different field.
