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

The second job is `e2e`. It installs Chromium with `npx playwright install --with-deps chromium`, copies `.env.example` to `.env` so `next build` has `DATABASE_URL`, and runs `npm run test:e2e` (reseed `prisma/e2e.db`, production build, Playwright on port 3100). `CI=true` is set, which makes Playwright retry a failed test once (`retries` in `playwright.config.ts`). This job is required. It does not set `continue-on-error`. Lint, typecheck, Vitest, and Playwright all have to pass.

No existing test was removed or edited. The conflict-prompt assertion is unchanged.

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

The first baseline and the first Actions run failed the conflict-prompt test. That failure is fixed. See "Known issue resolved" below. Playwright is a required job again.

Pushing `.github/workflows/ci.yml` was accepted. The credential used for this branch can update workflow files.

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

On the pull request, open the Checks tab. Both `Lint, typecheck, and unit tests` and `Playwright` are required. Run 42841709016 stayed green only because Playwright was allowed to fail. That allowance was removed before run 42845752938, and both jobs passed there.

## Known issue resolved

### Reproduction

`e2e/edge.spec.ts` › `the later saver of an issue gets a conflict prompt`. The assertion was left as written: after Marcus's first rename, `getByText('renamed the issue')` must have count 1, and after the second rename it must have count 2.

On this machine, before the fix, 8 solo runs of that test against a production build were **5 passed, 3 failed**. Failures were `expected 1, received 0` on the first rename, or `expected 2, received 1` on the second. The same test failed in the full suite (41 passed, 1 failed) and on Actions run [42841709016](https://github.com/bob1525/linear-build/actions/runs/42841709016): the Playwright job failed in 3m23s, including the one CI retry (first attempt saw 0 rename lines, retry saw 1).

### Root cause

Not a seed or database problem, and not a missed write in the conflict path. On a failing run the server action returned `ok: true`, and `prisma/e2e.db` already contained the `title_changed` row (one row per rename, with the right from/to payload). `getIssuePage` logged the new activity within about 20 ms of the write. The page Marcus was looking at still showed only "Ava Chen created the issue", while the title field showed the text he had just typed.

The activity list is rendered only from the server component props. `router.refresh()` and the revalidated server-action payload both run inside React `startTransition`. That transition often never commits, so the new activity stays off the screen for the whole 10 second assertion. Status changes and comments already append a local activity when the action returns. A title change did not. The fingerprint used to drop a local row once the server copy arrived was `type + actor + description text`. Every rename has the same description ("renamed the issue"), so a second local rename would have been hidden by the first server row.

A later refresh can also replace the title field while the next rename is being typed. That is a separate race on the same page. The field now keeps an in-progress edit, and Reload still discards it.

### Fix

`TitleEditor` reads the title from the field on blur and, when the save succeeds, appends a `title_changed` activity with the same `{ from, to }` payload the server stores. The activity fingerprint includes that payload, so two renames stay visible and the local row is dropped once the matching server row arrives. A dirty field is not overwritten by a refresh. Reload bumps a counter that accepts the server title again. The conflict assertion was not changed. `continue-on-error` was removed from the Playwright job.

### Evidence

After the fix, on this machine (Node v22.23.4):

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass. No ESLint warnings or errors. Next.js still prints that `next lint` is deprecated. |
| `npm test` | **71/71** |
| Solo conflict test, 8 runs | **8 passed, 0 failed** |
| `npm run test:e2e` | **42 passed** (1.2 minutes of tests), including `the later saver of an issue gets a conflict prompt` |

The Actions run for the commit that removes `continue-on-error` is [42845752938](https://github.com/bob1525/linear-build/actions/runs/42845752938) (`push`, head `5cbb450`, created 2026-11-10T15:34:30Z, finished 2026-11-10T15:37:02Z). Workflow conclusion: **success**. Both jobs are required.

| Job | Conclusion | What it did |
| --- | --- | --- |
| Lint, typecheck, and unit tests | success (39s, 15:34:32Z–15:35:11Z) | `npm ci`, lint, `tsc --noEmit`, and Vitest passed |
| Playwright | success (2m29s, 15:34:32Z–15:37:01Z) | Chromium installed. `npm run test:e2e` passed, including the conflict-prompt test |

No job failed. Playwright is a required gate on this run, not `continue-on-error`.
