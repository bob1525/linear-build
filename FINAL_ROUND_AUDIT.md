# Final round audit

This round closed the gaps left after the product stages: CI, screenshots of the later features, a repeatable performance check, a narrow-viewport check, and production deployment notes. No product test was removed or weakened. The only new tests are the two mobile end-to-end tests.

## The five stages

| Stage | What changed | Self-check |
| --- | --- | --- |
| 1. GitHub Actions | `.github/workflows/ci.yml` runs lint, `tsc --noEmit`, Vitest, and Playwright on push and pull request. The conflict-prompt failure was a title save that did not append its activity until a refresh committed. The save now appends that row immediately. Playwright is a required job. | [CI_SETUP.md](CI_SETUP.md) |
| 2. Screenshots | The capture script also writes the relations board, the relations section, the saved-views menu, the batch bar, the conflict dialog, and the Relay drag lab. | [SCREENSHOTS_UPDATE.md](SCREENSHOTS_UPDATE.md) |
| 3. Performance automation | `npm run perf` reseeds 500 issues, builds, measures, and prints the machine. `.github/workflows/perf.yml` runs it on pull requests and warns when the board-load median is not under 2000 ms. The job still succeeds on that warning. | [PERF_AUTOMATION.md](PERF_AUTOMATION.md) |
| 4. Mobile | Playwright project `mobile` is Chromium at 375×812. Two tests cover the drawer and horizontal board scroll. `docs/screenshots/board-mobile.png` is the Orbit board at that width. The drawer backdrop is only the dimmed strip, because its center used to sit under the sidebar. | [MOBILE_VERIFICATION.md](MOBILE_VERIFICATION.md) |
| 5. Deployment and this audit | The README has a Production deployment section: `DATABASE_URL`, the single-writer SQLite limit, `next start` on one machine, and why the SQLite file does not belong on Vercel. Demo accounts and the Fill demo button have to change before a public site. | This file |

## Files added or changed

From `b45963c` (end of the product work) through the stage 4 evidence commit `6a51103`, plus this stage's README and this audit:

- `.github/workflows/ci.yml`, `.github/workflows/perf.yml`
- `CI_SETUP.md`, `SCREENSHOTS_UPDATE.md`, `PERF_AUTOMATION.md`, `MOBILE_VERIFICATION.md`, `FINAL_ROUND_AUDIT.md`
- `PERFORMANCE.md`, `README.md`
- `scripts/capture-screenshots.ts`, `scripts/measure-perf.ts`, `scripts/run-perf.ts`
- `playwright.config.ts`, `e2e/mobile.spec.ts`, `package.json`
- `src/components/issue-detail.tsx` (title activity), `src/components/shell.tsx` (backdrop)
- `docs/screenshots/`: `board-with-relations.png`, `issue-detail-relations.png`, `saved-views-menu.png`, `batch-operations.png`, `conflict-dialog.png`, `relay-drag-lab.png`, `board-mobile.png`, and refreshed copies of the earlier shots

## Tests

Tests added this round: **2** end-to-end tests, both in `e2e/mobile.spec.ts`. No unit tests were added. The original counts are still **71** unit tests and **42** desktop end-to-end tests. The full Playwright command now runs **44** tests because the mobile project runs first.

### Local rerun for this stage

2026-11-10, Node v22.23.4, on the tree that includes the Production deployment section:

| Check | Result |
| --- | --- |
| `.github/workflows/ci.yml` | Present |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **71/71** |
| `npm run test:e2e` | **44 passed** (1.2 minutes). `[mobile]` 2 passed, then `[chromium]` **42 passed**, including `the later saver of an issue gets a conflict prompt` |

### CI that ran the same tests

The code this stage documents was already green on [42851852777](https://github.com/bob1525/linear-build/actions/runs/42851852777) (`push`, `6a51103`). Unit tests **71/71** (16:10:24Z–16:11:00Z). Playwright **44 passed** (16:10:24Z–16:12:55Z), both `[mobile]` tests and the original 42. The earlier required-gate run for the conflict fix is [42845752938](https://github.com/bob1525/linear-build/actions/runs/42845752938). The Actions run for this audit commit is in the next section.

## Remaining limits

- SQLite is one writer. Several `next start` processes, or a serverless host, will not share the file. The README says to run one Node process, and not to put `file:./dev.db` on Vercel.
- Schema changes use `prisma db push`. There is no migration history.
- Sign-in has no rate limit, email verification, or password reset. The seed password is `demo1234`, and the login page shows it with Fill demo. Both have to change before a public deploy.
- The mobile project covers the drawer and horizontal scrolling, plus one screenshot. It does not repeat the desktop suite at 375×812.
- The performance workflow warns above a 2000 ms board-load median and does not fail the job. Columns are not virtualized. The measured set is 500 issues.
- On the first hosted performance run the longest drag frame gap was 50 ms. The board-load median was 587 ms, so the check stayed green.

## Acceptance checklist

| Item | Result |
| --- | --- |
| `CI_SETUP.md` records the workflow, the conflict fix, and a green required Playwright job | Met. [CI_SETUP.md](CI_SETUP.md). Run [42845752938](https://github.com/bob1525/linear-build/actions/runs/42845752938) |
| `.github/workflows/ci.yml` exists and runs on push and pull request | Met. Lint, typecheck, Vitest, and Playwright. Playwright is required |
| `SCREENSHOTS_UPDATE.md` and at least four later-feature screenshots | Met. Six new feature shots plus `board-mobile.png` in `docs/screenshots/`. README Screenshots describes them |
| `PERF_AUTOMATION.md`, `npm run perf`, and a pull-request check with a 2000 ms board-load warning | Met. Run [42848735418](https://github.com/bob1525/linear-build/actions/runs/42848735418), median 587 ms, `status=ok` |
| `PERFORMANCE.md` has the machine, how to reproduce, and the automation | Met |
| `MOBILE_VERIFICATION.md`, a 375×812 project, two mobile tests, and one mobile screenshot | Met. CI run [42851321920](https://github.com/bob1525/linear-build/actions/runs/42851321920) reported 44 passed |
| README Production deployment: env vars, SQLite single-writer limit, `next start`, serverless honesty, demo secrets | Met. This stage |
| Original 71 unit tests and 42 end-to-end tests still pass | Met locally on this rerun, and on CI run [42851852777](https://github.com/bob1525/linear-build/actions/runs/42851852777) |
| Tests added this round | 2 end-to-end tests. No unit tests added, and none removed |
| `FINAL_ROUND_AUDIT.md` committed with the stage links, files, evidence, and these limits | Met on this commit |

## Actions run

Recorded after the workflow for this commit finishes.
