# Screenshot fix

## What was done

`board.png` and `board-with-relations.png` were the same file. `conflict-dialog.png` still showed the "Created ORB-21" toast from the throwaway issue.

`scripts/capture-screenshots.ts` now crops `board-with-relations.png` to the Todo column, from the column header through the Blocked card. That crop contains ORB-3 (Blocks) and ORB-2 (Blocked). The script refuses to finish if that file's sha256 still matches `board.png`. `board.png` stays the full Orbit board.

Before the conflict screenshot, the script waits until no `role="status"` toast is left. The create toast lasts 3.2 seconds, and the rest of the capture can finish sooner, which is why the old shot still had it. The throwaway issue is still deleted afterward.

The README caption for the relations image now says it is the Todo column.

## Baseline

Recorded on this tree before the script change, Node v22.23.4, 2026-11-10.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **71/71** |
| `npm run test:e2e` | **44 passed** (1.3 minutes). Mobile 2, then the original 42 desktop tests |

No test was edited.

## Verification method

1. `sha256sum` the two board files before the change.
2. `npm run db:setup`, then `npm run start -- --hostname 127.0.0.1 --port 3000`.
3. `npx tsx scripts/capture-screenshots.ts --fixes`, twice. `--fixes` rewrites only `board-with-relations.png` and `conflict-dialog.png`.
4. Compare sha256. Read both new PNGs.
5. `sqlite3` count of issues whose title contains "Conflict shot".
6. `npx tsc --noEmit` after the script edit.

## Evidence

Before:

| File | sha256 |
| --- | --- |
| `docs/screenshots/board.png` | `f48101870ffcf0c7df49a51a076ee5bf601e253341aa1e46e23781fea492d7a3` |
| `docs/screenshots/board-with-relations.png` | `f48101870ffcf0c7df49a51a076ee5bf601e253341aa1e46e23781fea492d7a3` |
| `docs/screenshots/conflict-dialog.png` | `d2159a947f2c60a8521f69b08e66ab64c0e0414f7cd65a3c670594aab900366f` |

The two board hashes matched.

After both `--fixes` runs (the second run matched the first byte for byte):

| File | sha256 |
| --- | --- |
| `docs/screenshots/board.png` | `f48101870ffcf0c7df49a51a076ee5bf601e253341aa1e46e23781fea492d7a3` (unchanged) |
| `docs/screenshots/board-with-relations.png` | `aee728bc500838391c19ebe032b5ac9dc8a46aad01ea302e33bfe8e4b9c42912` |
| `docs/screenshots/conflict-dialog.png` | `d1a11ce0c2b33053a2bdfc187264bc57e3f8a5217165da8c86a505d114e6d221` |

`board-with-relations.png` is the Todo column: header "Todo 6", ORB-3 with Blocks, ORB-2 with Blocked. `conflict-dialog.png` shows "This issue changed", Marcus Hale, Reload, and Overwrite. The corner toast is gone. Issues titled "Conflict shot": 0.

`npx tsc --noEmit` passed after the script edit.

## Problems found

The old relations shot called `scrollIntoViewIfNeeded` on the two marked cards and then took another full-page screenshot. Both cards were already inside the 1440×900 viewport, so the scroll did nothing and the bytes matched `board.png`.

The conflict shot was taken as soon as the dialog appeared. The "Created …" toast was still inside its 3.2 second timer, in the bottom-right corner, clear of the dialog. Waiting for that status node to leave fixes it. Two captures in a row produced the same conflict file, with no toast.

## Actions run

Recorded after the workflow for this commit finishes.
