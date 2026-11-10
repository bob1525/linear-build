# Mobile verification

## What was done

Added a narrow Playwright project and two end-to-end tests that run only in that project. The existing desktop project skips that file, so the original 42 tests still use Desktop Chrome.

The close control behind the drawer was a full-screen button. Its center sits under the 248px sidebar, so a click there hits the drawer instead of the backdrop. The button now starts at the drawer's right edge (`left-[248px]`), which is the dimmed strip a person can actually tap.

`scripts/capture-screenshots.ts` writes `docs/screenshots/board-mobile.png` at 375×812. `npm run screenshots -- --mobile` captures only that file. The README Screenshots section includes it.

## Project config

`playwright.config.ts` project `mobile`:

- Chromium
- Viewport 375×812
- `deviceScaleFactor` 2, `isMobile`, `hasTouch`
- `testMatch`: `mobile.spec.ts`

Project `chromium` keeps `devices["Desktop Chrome"]` and `testIgnore`s `mobile.spec.ts`. `workers` is still 1. The mobile project is listed first, so those two tests read the fresh seed before the desktop tests change issues.

CI does not filter projects. The Playwright job runs `npm run test:e2e`, which is `playwright test` after the database reset and the production build, so the mobile project runs on every push and pull request.

## Test cases

`e2e/mobile.spec.ts`

1. `sidebar opens and closes on a narrow screen`. Signs in as Ava. The drawer starts off-screen and the Orbit link is not on screen. Open menu slides the drawer in, with Projects and Orbit on screen. The dimmed strip closes it again.
2. `board scrolls horizontally on a narrow screen and cards stay visible`. Opens Relay with `?all=1`. Relay backlog 01 is on screen and Relay done 01 is not. The board's scroll width exceeds its client width by more than 80px. Scrolling to the end puts Relay done 01 on screen and moves the backlog card off screen.

Neither test creates, edits, or deletes an issue.

## Screenshot

| File | What it shows |
| --- | --- |
| `docs/screenshots/board-mobile.png` | Orbit board at 375×812. The menu button is showing and the drawer is closed. Backlog cards are on screen (ORB-15, ORB-6, ORB-14). The next column is cut off at the right edge. |

## Verification method

1. `npm run lint`
2. `npm test`
3. `npm run test:e2e` (rebuilds, then both Playwright projects)
4. Read `docs/screenshots/board-mobile.png`
5. Read the Playwright job log on the push and confirm both `[mobile]` tests passed with the desktop tests

## Evidence

Local, 2026-11-10, Node v22.23.4:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npm test` | **71/71** |
| `npm run test:e2e` | **44 passed** in 1.1 minutes. `[mobile]` 2 passed, then `[chromium]` 42 passed, including the conflict-prompt test |

The mobile screenshot shows the closed drawer, the menu button, Backlog cards, and the next column clipped at the edge.

## Problems found

The drawer's close button included the area underneath the sidebar, so its center was not clickable. The backdrop is now only the dimmed strip. No other mobile failure showed up. At 375px the New issue button and the filter chips wrap onto extra rows. The board and its cards stay on screen.

## Actions run

[42851321920](https://github.com/bob1525/linear-build/actions/runs/42851321920) (`push`, head `b6cc691`, 2026-11-10). Workflow conclusion: **success**.

| Job | Conclusion | What it did |
| --- | --- | --- |
| Lint, typecheck, and unit tests | success (16:07:05Z–16:08:14Z) | Lint, `tsc --noEmit`, and Vitest **71/71** |
| Playwright | success (16:07:05Z–16:09:37Z) | **44 passed** in 1.4 minutes. `[mobile]` ran first: sidebar open/close (1.7s) and horizontal board scroll (1.6s). Then `[chromium]` passed the original 42 tests |

The command, the tests, the screenshot, and this note are committed on `cursor/linear-issue-tracker-ef1d`.
