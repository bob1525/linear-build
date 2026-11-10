# Merge readiness

## What was done

This is a checklist for merging [PR #1](https://github.com/bob1525/linear-build/pull/1). No repository setting was changed. No workflow, test, or product file was edited.

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

1. Open the pull request and confirm the head commit is the one you intend to merge. This note was written against `0917928`. Later commits need the same check names on their own SHA.
2. On that commit, every check named `Lint, typecheck, and unit tests` is **success**. On `0917928` the push run is [42863730820](https://github.com/bob1525/linear-build/actions/runs/42863730820): unit job success 17:19:19Z–17:20:00Z, Vitest **77/77**.
3. On that commit, every check named `Playwright` is **success**. On the same run the Playwright job succeeded 17:19:19Z–17:22:26Z, **46 passed**, and the log did not say flaky.
4. If Playwright is success and the log says `1 flaky` for only `opens the new issue dialog from the keyboard`, that is the known race below. The job can still be merged. If the job conclusion is **failure**, do not merge, and do not skip or edit the test to get past it.
5. If `Board load` is listed, a **success** conclusion means the measurement finished. Open the log and confirm `budgetMs=1200`. `status=ok` is the expected line. `status=warn` does not fail the job, so it is not a required gate. Record the median and decide whether to merge with that number visible. A **failure** or **cancelled** conclusion means the measurement did not finish. Rerun the Performance workflow. Do not treat that rerun as a required check.
6. Skim the diff for a deleted or skipped test. This branch has not removed one. The suite at `0917928` is 77 unit tests and 46 end-to-end tests.
7. Merge with whichever of the three methods you want. The head branch stays until someone deletes it.

## Keyboard shortcut flake

`e2e/issues.spec.ts` test `opens the new issue dialog from the keyboard` presses `c` and expects the New issue dialog. `login()` in `e2e/helpers.ts` returns when the URL matches `/p/ORB`. The shortcut is a `window` keydown listener added in an effect in `src/components/shell.tsx`, after the shell hydrates. A press that arrives before that effect does nothing, and the dialog wait then hits its 10 second timeout. The board does not autofocus an input, so the handler’s typing guard is not the miss.

CI already sets `retries: 1` when `CI` is set. The first attempt can fail and the retry can pass. Playwright then reports one flaky test and a successful job. That happened on [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385) (`9e5102f`): `1 flaky` and `43 passed`. The same test passed on the first attempt in [42861456974](https://github.com/bob1525/linear-build/actions/runs/42861456974), [42863142256](https://github.com/bob1525/linear-build/actions/runs/42863142256) (46 passed), and [42863730820](https://github.com/bob1525/linear-build/actions/runs/42863730820) (46 passed). The test file was not changed.

## Verification method

1. Read the `name` keys in `.github/workflows/ci.yml` and `.github/workflows/perf.yml`.
2. Read the check runs on `0917928` and the pull request rollup. Compare the strings.
3. Read merge settings and the ruleset list. Try to read classic protection on `main` and record the response. Do not send a write.

No test command was required. This commit does not change tests or product code.

## Evidence

Check runs on `091792820a19de8fa51f05f150cca396a525a838`, all `success`, app `github-actions`:

| Name | How many runs |
| --- | --- |
| `Lint, typecheck, and unit tests` | 2 (push and pull_request) |
| `Playwright` | 2 (push and pull_request) |
| `Board load` | 1 (pull_request only) |

The pull request rollup uses those same three names. `mergeStateStatus` was `CLEAN`.

Repository merge settings, read only: `allow_merge_commit`, `allow_squash_merge`, and `allow_rebase_merge` are true. `delete_branch_on_merge` is false. Default branch is `main`.

Rulesets: the list endpoint returned an empty list. Classic branch protection on `main` returned **403** `Resource not accessible by integration`. This token cannot see that rule, and it was not asked to create one.

## Problems found

The token cannot read classic branch protection, so this note cannot say whether `main` already requires checks. The ruleset list is empty. An admin still has to confirm the protection screen.

CI’s double trigger makes two runs share one check name. A protection rule does not distinguish them. Look at both before merging.

`Board load` staying green on a slow median is intentional. Requiring it would not tighten the 1200 ms budget.

## Actions run

[42864621185](https://github.com/bob1525/linear-build/actions/runs/42864621185) (`push`, head `020ce25`, 2026-11-10). Workflow conclusion: **success**. This commit only adds this note. The check names on the run are the ones in the table.

| Job | Conclusion | What it did |
| --- | --- | --- |
| Lint, typecheck, and unit tests | success (17:24:28Z–17:25:29Z) | Vitest **77/77** |
| Playwright | success (17:24:28Z–17:27:54Z) | **46 passed**. The log did not say flaky |

`Board load` is not part of this push workflow. It runs on the pull request.
