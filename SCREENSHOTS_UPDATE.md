# Screenshots update

## What was done

Extended `scripts/capture-screenshots.ts` and regenerated `docs/screenshots/` against the seeded demo app at http://127.0.0.1:3000 (production `next start`, `prisma/dev.db` reseeded with `npm run db:setup`). The earlier five screenshots are still produced. Six new files were added.

| File | Feature |
| --- | --- |
| `docs/screenshots/board-with-relations.png` | Orbit board with Blocks on ORB-3 and Blocked on ORB-2 |
| `docs/screenshots/issue-detail-relations.png` | ORB-1 relations section, including sub-issue ORB-5 |
| `docs/screenshots/saved-views-menu.png` | Saved-views menu after creating "Todo + high" from the Todo, High, and `cache` filters, with Rename, Set default, and Delete |
| `docs/screenshots/batch-operations.png` | List after selecting ORB-2 and ORB-3, with the batch bar (status, assignee, add label, remove label, delete) |
| `docs/screenshots/conflict-dialog.png` | Ava's later title save, stopped because Marcus saved first, with Reload and Overwrite |
| `docs/screenshots/relay-drag-lab.png` | Relay board: 12 Backlog cards, one Todo card, an empty In Progress column, and 8 Done cards |

## Script changes

`scripts/capture-screenshots.ts` still signs in as Ava and writes `login.png`, `board.png`, `filters.png`, `list.png`, and `issue-detail.png`.

- After the plain board shot, it scrolls the first Blocked marker and the first Blocks marker into view and writes `board-with-relations.png`.
- After the filter shot, it opens Saved views, deletes a leftover "Todo + high" view if one exists, saves that name, screenshots the open menu, then deletes the view so a later run does not keep it.
- On the list, it selects ORB-2 and ORB-3 and writes `batch-operations.png`.
- On ORB-1 it scrolls the Relations section to the top and writes `issue-detail-relations.png`.
- It opens `/p/RLY`, waits for Relay backlog 01, Relay short todo, and the empty In Progress column, and writes `relay-drag-lab.png`.
- `captureConflict` signs in as Ava and Marcus in two browser contexts, creates "Conflict shot original", has Marcus rename it, then has Ava save a different title. It screenshots Ava's conflict dialog and deletes every issue whose title contains "Conflict shot".

## Verification method

1. `npm run db:setup` so `prisma/dev.db` matches the demo seed.
2. `npm run start -- -p 3000`.
3. `npx tsx scripts/capture-screenshots.ts`, twice.
4. Read each new PNG and confirm the feature named above is on screen.
5. `sqlite3 prisma/dev.db` counts for leftover "Conflict shot" issues and the "Todo + high" view.
6. `npx tsc --noEmit` so the script still typechecks.

## Evidence

Both script runs exited 0 and printed `Wrote screenshots to docs/screenshots`. The second run is the committed set.

Visual check of that set:

- `board-with-relations.png`: Todo shows ORB-3 with Blocks and ORB-2 with Blocked.
- `issue-detail-relations.png`: Relations form, and Sub-issues lists ORB-5 "Keyboard shortcuts ignore the filter bar".
- `saved-views-menu.png`: the menu is open on the filtered board, the name field is visible, and "Todo + high" is listed with Rename, Set default, and Delete. The button reads "Saved views 1".
- `batch-operations.png`: "2 selected", Status, Assignee, Add label, Remove label, and Delete. ORB-3 and ORB-2 are checked.
- `conflict-dialog.png`: dialog title "This issue changed", body naming Marcus Hale, Reload and Overwrite. The activity list also shows "Marcus Hale renamed the issue". The same capture succeeded on the run before this one.
- `relay-drag-lab.png`: Backlog 12, Todo 1 ("Relay short todo"), In Progress 0 ("No issues"), Done 8.

After the second run, `Issue` rows whose title contains "Conflict shot": 0. `SavedView` rows named "Todo + high": 0.

## Problems found

The conflict dialog is reproducible. Both captures showed it. The second image still has a small "Created ORB-21" toast in the corner from creating the throwaway issue. It does not cover the dialog. The throwaway issue is deleted after the shot. No screenshot was skipped.

## Committed

The six PNGs, the script, this note, and the README Screenshots section are committed on `cursor/linear-issue-tracker-ef1d`.
