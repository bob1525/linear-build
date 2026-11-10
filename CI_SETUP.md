# CI setup

## What was done

Added `.github/workflows/ci.yml`. It runs on every `push` and every `pull_request`. Two jobs share a concurrency group per ref and cancel an older run of the same ref when a new one starts.

The required job is `unit`, on `ubuntu-latest`, Node.js 22:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with the npm cache
3. `npm ci`
4. `npm run lint`
5. `npx tsc --noEmit`
6. `npm test` (Vitest)

The second job is `e2e`. It installs Chromium with `npx playwright install --with-deps chromium`, copies `.env.example` to `.env` so `next build` has `DATABASE_URL`, and runs `npm run test:e2e` (reseed `prisma/e2e.db`, production build, Playwright on port 3100). `CI=true` is set, which makes Playwright retry a failed test once (`retries` in `playwright.config.ts`). This job is `continue-on-error: true`. Lint, typecheck, and Vitest are the gate. The Playwright job still runs, and its log is on the pull request.

No existing test was removed or edited.

## Verification method

Before writing the workflow, the suite was run on this machine (Node v22.23.4) from a clean working tree at `b45963c`:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run test:e2e` (reseed, `next build`, Playwright)

The conflict test was then run on its own with `npx playwright test e2e/edge.spec.ts -g "later saver"` against the build the full suite had just produced.

After the commit is pushed, the workflow file is checked on `origin/cursor/linear-issue-tracker-ef1d`, and the pull request's check runs are read with `gh`.

## Evidence

Baseline, recorded before this workflow existed:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors. Next.js printed that `next lint` is deprecated and will be removed in Next.js 16. That is a command notice, not a lint finding. |
| `npx tsc --noEmit` | Pass (exit 0) |
| `npm test` | **71/71** (activity 4, saved views 10, relations 18, batch 10, issue view 8, validators 4, concurrency 5, filters 7, kanban collision 5) |
| `npm run test:e2e` | **41 passed, 1 failed** (1.3 minutes of tests) |

The failure is `e2e/edge.spec.ts` › `the later saver of an issue gets a conflict prompt`. After Marcus's second rename, `getByText('renamed the issue')` stayed at 1 for 10 seconds; the test expected 2. The failure screenshot shows the title field already reading the second title, one "Marcus Hale renamed the issue" activity, no "Saving…" line, and no conflict dialog. A solo rerun of that test failed the same way (12.9 seconds). The same test had passed inside the previous full run of commit `b45963c` (42/42), so it is intermittent, not a missing browser.

The remote confirmation is in "Push and the pull request" below.

## Problems found

Playwright can execute in this environment: 41 of the 42 tests passed, including auth, batch, drag, filters, issues, relations, views, and the other edge cases. The conflict-prompt test does not reliably record the second rename in the activity list within the 10 second expect timeout. Because of that, `npm run test:e2e` is not a stable required gate. The workflow still runs it and keeps the log. The required gate is lint, typecheck, and Vitest.

Pushing `.github/workflows/ci.yml` needs a credential that is allowed to update workflow files. If the push is rejected, the rejection is copied below instead of being routed around.

## How to view results

On https://github.com/bob1525/linear-build/pull/1, open the **Checks** tab, or the checks list at the bottom of the **Conversation** tab. `Lint, typecheck, and unit tests` is the gate. `Playwright` is the end-to-end log. A cancelled run means a newer push to the same ref replaced it.

## Push and the pull request

The workflow file is on `origin/cursor/linear-issue-tracker-ef1d` at commit `0e0ce31` (`git ls-tree` shows `.github/workflows/ci.yml`, blob `b9144bed77ad7042f8cd5d72cd1b7de09101e71b`). The push was accepted. It did not need a separate workaround. The credential used for this push is allowed to update workflow files.

Pushing that commit started Actions run [42841709016](https://github.com/bob1525/linear-build/actions/runs/42841709016) (`push`, head `0e0ce31`, finished in 3m27s). The workflow conclusion is **success** because the Playwright job is allowed to fail. The jobs themselves:

| Job | Conclusion | What it did |
| --- | --- | --- |
| Lint, typecheck, and unit tests | success (44s) | `npm ci`, lint, `tsc --noEmit`, and Vitest all passed |
| Playwright | failure (3m23s) | Chromium installed. `npm run test:e2e` reported **41 passed, 1 failed**. The failure is the same conflict test. The first attempt waited for one "renamed the issue" and saw 0. The CI retry (`retries: 1`) waited for two and saw 1. |

A second run, [42841891655](https://github.com/bob1525/linear-build/actions/runs/42841891655), was queued by the `pull_request` event for the same push. It was still in progress when the push run finished. Both events are configured, so one push to this pull-request branch starts two workflows.

On the pull request, open the Checks tab. The unit job is the gate. The Playwright job is the end-to-end log, and on this run it is red. The workflow stays green only because that job sets `continue-on-error`.
