# Merge readiness

## What was done

This is a checklist for merging [PR #1](https://github.com/bob1525/linear-build/pull/1). No repository setting was changed. No workflow, test, or product file was edited.

The checklist below was refreshed after the continued-upgrade round. The required check names are the same ones this note first recorded. The keyboard-shortcut race, the conflict-reload race, the dropped search commit, and the project-create refresh race are fixed, and the suite counts are the current ones. The older wording, which treated a flaky keyboard test as mergeable and cited 77 unit tests and 46 end-to-end tests on `0917928`, is replaced in the sections below. The follow-up revision cited 114 unit tests and 56 end-to-end tests on `08dfded`. That count was current then. The continued-upgrade record is [CONTINUED_UPGRADE_AUDIT.md](CONTINUED_UPGRADE_AUDIT.md).

The required-check names below are the job `name` values GitHub Actions reports. They are not the job ids `unit`, `e2e`, and `measure`.

| Workflow file | Job id | Check name to type into branch protection | Require it |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | `unit` | `Lint, typecheck, and unit tests` | Yes |
| `.github/workflows/ci.yml` | `e2e` | `Playwright` | Yes |
| `.github/workflows/perf.yml` | `measure` | `Board load` | No |

`Board load` should stay optional. The 1200 ms budget prints `status=warn` and the process still exits 0, so a required check would not enforce the budget. It only fails when the seed, the build, or the measurement itself fails. It also runs on `pull_request` and `workflow_dispatch`, not on `push`. Read the log before merging. Do not add the name to the required list unless a later change makes a budget miss fail the job.

CI runs on both `push` and `pull_request`, so the pull request page lists `Lint, typecheck, and unit tests` twice and `Playwright` twice. The protection rule is one name. Every listed run of that name on the head commit still has to be success.

## How an admin turns the checks on

Someone with permission to change repository settings does this. This agent did not.

1. Open the repository settings for `bob1525/linear-build`, then either a classic branch protection rule for `main` or a ruleset that targets `main`.
2. Require a pull request before merging.
3. Require status checks to pass before merging.
4. Search for and select exactly `Lint, typecheck, and unit tests`.
5. Search for and select exactly `Playwright`.
6. Do not select `Board load`.
7. Save. If the search box shows `CI / Lint, typecheck, and unit tests` or `CI / Playwright`, that is the same job. Select the entry whose check name matches the table.

## Checklist for merging PR #1

PR: https://github.com/bob1525/linear-build/pull/1. Base `main`. Head `cursor/linear-issue-tracker-ef1d`. The repo allows a merge commit, a squash, or a rebase. It does not delete the head branch on merge.

1. Open the pull request and confirm the head commit is the one you intend to merge. The suite this checklist uses is the continued-upgrade round: Vitest **125** and Playwright **58**, green on evidence head `b241b79`. A later commit needs the same check names on its own SHA. If that commit adds tests, use the count in its log. This revision’s own runs are in [CONTINUED_UPGRADE_AUDIT.md](CONTINUED_UPGRADE_AUDIT.md).
2. On that commit, every check named `Lint, typecheck, and unit tests` is **success**. On `b241b79` the push run is [46027503831](https://github.com/bob1525/linear-build/actions/runs/46027503831): unit job success 15:44:03Z–15:45:07Z, Vitest **125/125**. The pull request run is [46027516191](https://github.com/bob1525/linear-build/actions/runs/46027516191): unit job success 15:44:08Z–15:45:05Z, Vitest **125/125**.
3. On that commit, every check named `Playwright` is **success**, and the log does not say flaky. On the push run above, Playwright succeeded 15:44:02Z–15:46:24Z, **58 passed**. On the pull request run, Playwright succeeded 15:44:07Z–15:46:48Z, **58 passed**.
4. A Playwright **failure** is not a pass. A log that says flaky is not a pass either. The keyboard shortcut race is fixed: `login()` waits until the shell sets `data-shortcuts="ready"`. See [KEYBOARD_FLAKE_FIX.md](KEYBOARD_FLAKE_FIX.md). The conflict-reload race is fixed: Reload writes the winning title once. See [CONFLICT_RELOAD_FIX.md](CONFLICT_RELOAD_FIX.md). A search commit that a refresh can drop is fixed: the search box commits again 250 ms later if the query is still missing. See [POSTGRES_PATH.md](POSTGRES_PATH.md). Creating a project no longer calls `router.refresh()` beside `router.push`. On `b241b79` the suite passed on the first attempt. Do not skip or edit a test to get past a failure.
5. If `Board load` is listed, a **success** conclusion means the measurement finished. Open the log and confirm `budgetMs=1200`. `status=ok` is the expected line. `status=warn` does not fail the job, so it is not a required gate. Record the median and decide whether to merge with that number visible. A **failure** or **cancelled** conclusion means the measurement did not finish. Rerun the Performance workflow. Do not treat that rerun as a required check. On `b241b79` the pull request run is [46027516229](https://github.com/bob1525/linear-build/actions/runs/46027516229): board-load median 488 ms, `status=ok`, list-load median 408 ms, 19 mounted at the top and 19 at the end.
6. Skim the diff for a deleted or skipped test. This branch has not removed one. The suite at `b241b79` is 125 unit tests and 58 end-to-end tests.
7. Merge with whichever of the three methods you want. The head branch stays until someone deletes it.

## Races that are fixed

`opens the new issue dialog from the keyboard` used to miss the dialog when `c` arrived before the shell attached its listener. `login()` now waits for `data-shortcuts="ready"`. The test file was not weakened. The fix and the green runs are in [KEYBOARD_FLAKE_FIX.md](KEYBOARD_FLAKE_FIX.md). The first version of this checklist said a job that reported `1 flaky` for only that test could still be merged. That sentence is withdrawn. The old flake was on [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385) (`9e5102f`).

`the later saver of an issue gets a conflict prompt` used to keep the other person’s title joined to the title the page had loaded after Reload. Reload now writes the winning title once and remounts the field. The assertion was not changed. The fix and the green runs are in [CONFLICT_RELOAD_FIX.md](CONFLICT_RELOAD_FIX.md). [UPGRADE_ROUND_AUDIT.md](UPGRADE_ROUND_AUDIT.md) still describes the race as it was on `f62b366`. That description is the record of that commit.

`shows which issue failed when part of a batch no longer exists` stayed on `/p/ORB` when a refresh dropped the search `router.push`. The search box now commits again 250 ms later if the query is still missing. The pull request run that passed only on that retry, [46024361115](https://github.com/bob1525/linear-build/actions/runs/46024361115), is not a pass. The assertion was not changed.

`signs up, creates a project, and shows the empty board` stayed on `/welcome` when `router.refresh()` ran beside `router.push`. The form now only pushes. The failed pull request run is [46026061020](https://github.com/bob1525/linear-build/actions/runs/46026061020). The conflict test on that same run retried once and is not a pass either. The assertion was not changed. Both fixes and the later green runs are in [POSTGRES_PATH.md](POSTGRES_PATH.md).

## Verification method

1. Read the `name` keys in `.github/workflows/ci.yml` and `.github/workflows/perf.yml`. They are still `Lint, typecheck, and unit tests`, `Playwright`, and `Board load`.
2. Read the check runs on `b241b79`. Compare the strings with the table above.
3. Read merge settings and the ruleset list. Try to read classic protection on `main` and record the response. Do not send a write.
4. The continued-upgrade audit reran lint, typecheck, Vitest, and Playwright. The commands, the outputs, and the CI run ids are in [CONTINUED_UPGRADE_AUDIT.md](CONTINUED_UPGRADE_AUDIT.md).

## Evidence

Check runs on `b241b7982c25446ebfa3a417d67ff69a0cc569f0`, all `success`, app `github-actions`:

| Name | How many runs |
| --- | --- |
| `Lint, typecheck, and unit tests` | 2 (push [46027503831](https://github.com/bob1525/linear-build/actions/runs/46027503831) and pull request [46027516191](https://github.com/bob1525/linear-build/actions/runs/46027516191)) |
| `Playwright` | 2 (the same two runs) |
| `Board load` | 1 (pull request [46027516229](https://github.com/bob1525/linear-build/actions/runs/46027516229)) |

The pull request rollup uses those same three names.

The first version of this note used `091792820a19de8fa51f05f150cca396a525a838`. On that commit the push run [42863730820](https://github.com/bob1525/linear-build/actions/runs/42863730820) reported Vitest 77/77 and Playwright 46 passed. Those counts were current then. They are not the suite now.

Repository merge settings, read again on 2026-11-27: `allow_merge_commit`, `allow_squash_merge`, and `allow_rebase_merge` are true. `delete_branch_on_merge` is false. Default branch is `main`.

Rulesets: the list endpoint returned an empty list. Classic branch protection on `main` returned **403** `Resource not accessible by integration`. This token cannot see that rule, and it was not asked to create one.

## Problems found

The token cannot read classic branch protection, so this note cannot say whether `main` already requires checks. The ruleset list is empty. An admin still has to confirm the protection screen.

CI’s double trigger makes two runs share one check name. A protection rule does not distinguish them. Look at both before merging.

`Board load` staying green on a slow median is intentional. Requiring it would not tighten the 1200 ms budget.

The first checklist allowed the old keyboard flake and cited 77 unit tests and 46 end-to-end tests. The follow-up revision cited 114 and 56 on `08dfded`. This revision uses 125 unit tests and 58 end-to-end tests on `b241b79`. The required check names did not change.

## Actions run

The run below is the first version of this note, on `020ce25`. It is not the current suite. The follow-up revision’s CI is recorded in [FOLLOWUP_UPGRADE_AUDIT.md](FOLLOWUP_UPGRADE_AUDIT.md). The continued-upgrade revision’s CI is recorded in [CONTINUED_UPGRADE_AUDIT.md](CONTINUED_UPGRADE_AUDIT.md).

[42864621185](https://github.com/bob1525/linear-build/actions/runs/42864621185) (`push`, head `020ce25`, 2026-11-10). Workflow conclusion: **success**. The check names on that run are the ones in the table.

| Job | Conclusion | What it did |
| --- | --- | --- |
| Lint, typecheck, and unit tests | success (17:24:28Z–17:25:29Z) | Vitest **77/77** |
| Playwright | success (17:24:28Z–17:27:54Z) | **46 passed**. The log did not say flaky |

`Board load` is not part of this push workflow. It runs on the pull request.
