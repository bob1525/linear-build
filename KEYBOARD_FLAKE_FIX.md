# Keyboard shortcut flake

`opens the new issue dialog from the keyboard` (`e2e/issues.spec.ts`) could fail once on CI and pass on the existing retry. The assertion was not the problem. `login()` returned when the URL matched `/p/ORB`, and the `c` listener is attached in a `useEffect` after the shell hydrates. A press in that gap does nothing, then the dialog wait hits 10 seconds.

## What changed

The shell sets `data-shortcuts="ready"` on `document.documentElement` in the same effect that calls `window.addEventListener("keydown", onKey)`, after the listener is attached. Cleanup removes the attribute with the listener.

`login()` in `e2e/helpers.ts` still waits for `/p/ORB`, then waits until `html` has `data-shortcuts="ready"`, and only then returns. Every test that signs in through that helper gets the same wait.

Not changed:

- The test body in `e2e/issues.spec.ts` (press `c`, expect the New issue dialog, Escape, press `/`, expect the search field focused).
- Playwright `retries`. CI is still `1`. Local is still `0`. The test was not marked flaky.
- No assertion was loosened and no test was removed.

`MERGE_READINESS.md` and `AUTH_HARDENING.md` still describe the race as it was before this change. This stage does not edit them.

## Baseline before the change

2026-11-27, Node v22.23.4, head `1fd39cd`. Dependencies were installed with `npm ci` on this machine first.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **77/77** |
| `npm run test:e2e` | **46 passed** (1.2 minutes) |

The keyboard test passed on that local run in 419 ms. It did not flake here. Local runs have no retry, and the machine is fast enough that hydration usually wins. The misses that this fixes were on CI:

- Push of `9e5102f`: [42860025385](https://github.com/bob1525/linear-build/actions/runs/42860025385). Playwright `1 flaky` and `43 passed`. First attempt of this test did not find the dialog in 10 seconds. Retry passed. The job stayed green.
- Pull request of `1fd39cd`: [42866823702](https://github.com/bob1525/linear-build/actions/runs/42866823702). Playwright `1 flaky` and `45 passed`. Same test, same retry. The job stayed green.

## Verification after the change

Same machine, Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **77/77** (10 files) |
| `npm run test:e2e` | **46 passed** (1.3 minutes) |

The keyboard test in that full run passed in 406 ms. The log line is a pass, not `retry #1`.

Then the same test alone, with `--retries=0`, five times. Each run started its own server. All five passed on the only attempt: 586 ms, 496 ms, 500 ms, 459 ms, 490 ms. No failure output.

`git diff` for this stage is `e2e/helpers.ts` and `src/components/shell.tsx`. `e2e/issues.spec.ts` and `playwright.config.ts` are untouched.

## Problems found

None in this change. The local baseline did not reproduce the flake, which matches the earlier note that the miss depends on the key landing before the effect. The wait is on the attribute written after `addEventListener`, so `login()` cannot return in that gap.

The CI retry is still configured. It is the same retry as before, not a new one. A first-attempt failure would still be visible in the log as flaky or failed. This stage does not treat a retry as a pass.

## Actions run

Push of `7c9a36b`: [45976755038](https://github.com/bob1525/linear-build/actions/runs/45976755038), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 09:48:21Z to 09:49:37Z. **77 passed**.
- `Playwright`: 2026-11-27 09:48:21Z to 09:51:37Z. **46 passed** (1.4 minutes). No flaky test. `opens the new issue dialog from the keyboard` passed on the first attempt (440 ms). The log has no `retry #1` for it.

Pull request of the same commit: [45976766833](https://github.com/bob1525/linear-build/actions/runs/45976766833), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 09:48:25Z to 09:49:24Z. **77 passed**.
- `Playwright`: 2026-11-27 09:48:25Z to 09:51:44Z. **46 passed** (1.4 minutes). No flaky test. The keyboard test passed on the first attempt (513 ms).
