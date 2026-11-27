# Conflict reload fix

`the later saver of an issue gets a conflict prompt` (`e2e/edge.spec.ts`) failed once on pull request CI and passed on the existing retry. After Reload, the title field stayed on the other user's saved title joined to the title that page had loaded. The assertion was not the problem.

## What changed

Reload keeps the `updatedAt` from the conflict result, which is the version that won. The title field is replaced only when the page props are that version, and only with `issue.title` from those props.

The failed save is a server action, so the page can already be on that version while the field still shows the draft. A dirty field is still left alone until Reload. Reload then writes that one title and remounts the textarea, so the new node is created with that string. `onChange` and blur-save are ignored until the replacement has committed, so a joined DOM value cannot become the field value. A second pass of the same Reload does not write again.

Not changed:

- The test body in `e2e/edge.spec.ts`.
- Playwright `retries`. CI is still `1`. Local is still `0`. The test was not marked flaky.
- No assertion was loosened and no test was removed.

## Baseline before the change

2026-11-27, Node v22.23.4, head `e84bdef`.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **95/95** (13 files) |
| `npm run test:e2e` | **47 passed** (1.2 minutes) |

The conflict test passed on that local run in 3.0 seconds. The keyboard test passed in 441 ms. Local runs have no retry. The joined title was on CI:

- Pull request of `f62b366`: [45986012092](https://github.com/bob1525/linear-build/actions/runs/45986012092). Playwright `1 flaky` and `46 passed`. First attempt expected `… marcus` and received `… marcus` immediately followed by `… original`. The value stayed for the 10 second timeout. Retry passed in 3.0 seconds. The job stayed green.

## Verification after the change

Same machine, Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **98/98** (14 files) |
| `npm run test:e2e` | **47 passed** (1.2 minutes) |

The conflict test in that full run passed on the first attempt (3.3 seconds). The keyboard test passed on the first attempt (410 ms). The log line is a pass, not `retry #1`.

Then the same conflict test alone, with `--retries=0 --repeat-each=5`. All five passed on the only attempt: 3.2 seconds, 2.4 seconds, 5.7 seconds, 3.4 seconds, 6.6 seconds. No failure output.

`e2e/edge.spec.ts` and `playwright.config.ts` are untouched. The new unit tests are in `tests/unit/title-reload.test.ts`.

## Problems found

The first cut of this fix waited for `updatedAt` to change from the value on the page at the click. That run failed the existing assertion: the field stayed on the draft (`… reload me`) for the whole 10 second timeout. The failed save had already refreshed the page onto the winning version, so `updatedAt` never moved again and the draft was never replaced. The assertion was not changed. The fix above waits for the version in the conflict result, which is already the page version in that case.

The CI retry is still configured. It is the same retry as before, not a new one. A first-attempt failure would still be visible in the log as flaky or failed. This stage does not treat a retry as a pass.

## Actions run

Recorded after the workflow for this commit finishes.
