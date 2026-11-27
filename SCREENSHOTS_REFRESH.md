# Screenshot refresh

`docs/screenshots/login.png` is the production sign-in page. Fill demo and the demo password are not on it. `docs/screenshots/change-password.png` is the signed-in `/account` page. No test was edited.

## What was done

The previous `login.png` was the development sign-in page. It showed the Demo workspace block, Fill demo, `ava@northstar.dev · demo1234`, and the four seeded accounts.

`scripts/capture-screenshots.ts` now refuses to write `login.png` when that block, or the demo password, is on the page. It also writes `change-password.png` after signing in. `npm run screenshots -- --refresh` rewrites only those two files. A full `npm run screenshots` still writes the rest, and it takes the password page before it returns to the Orbit board.

The README caption under the sign-in image says this is the production page. The Screenshots section includes the password page. The refresh note says the script expects `next start` with `NORTHSTAR_SHOW_DEMO` unset.

## How it was verified

2026-11-27, on `04be90a` plus this change. Node v22.23.4.

1. `npm run db:setup` created `prisma/dev.db` and seeded Ava.
2. `env -u NORTHSTAR_SHOW_DEMO npm run start -- --hostname 127.0.0.1 --port 3000`.
3. `curl -s http://127.0.0.1:3000/login` returned the sign-in form. The HTML did not contain `Fill demo`, `Demo workspace`, or `demo1234`. It did contain `Sign in to Northstar` and `Create an account`.
4. `npx tsx scripts/capture-screenshots.ts --refresh`, twice. The script checks the visible login text and the HTML for `demo1234` before it writes the file, and it checks the account page text for `demo1234` and `Fill demo`.
5. `sha256sum` both files. The second run matched the first byte for byte.
6. Both PNGs were read. `login.png` is the sign-in card only. `change-password.png` is Ava on `/account`, with the current, new, and confirm fields empty.
7. `npx tsc --noEmit` passed. `npm run lint` passed. No test was edited, so the unit and end-to-end suites were not rerun locally. The other screenshots were not rewritten.

## Evidence

| File | sha256 |
| --- | --- |
| `docs/screenshots/login.png` before | `1041cc1e7939e34b30fea9307851e13db277d60a55d828884d24917ba84c10f1` |
| `docs/screenshots/login.png` after | `3d2357e32db637c03795a4bf840c05f8de65ccb20c490bd81598c99adc039935` |
| `docs/screenshots/change-password.png` | `b7151b52695b994493762eea61e024565d6c17e45dfce13c14fa0c384f3a3420` |

Both new files are 2880×1800, the 1440×900 viewport at a scale of 2. `login.png` went from 741035 bytes to 728906 bytes. `change-password.png` is 111271 bytes. Neither file contains the bytes `Fill demo`, `demo1234`, or `Demo workspace`.

The new sign-in image shows the mark, “Sign in to Northstar”, the email and password fields, Sign in, and “New here? Create an account”. It does not show Fill demo, `demo1234`, or the seeded account list.

The password image shows the shell, signed in as Ava Chen, the heading “Change password”, the note that other sessions are signed out and that the page does not email a reset link, and the three empty password fields.

## Problems found

The first `--refresh` run wrote `login.png` and then failed before `change-password.png`. `getByLabel("New password")` also matched “Confirm new password”, because Playwright’s label lookup is not exact unless asked. The account page was already rendered. The script now waits with `{ exact: true }`. No product code changed. The two runs after that fix matched the hashes above.

## Actions run

Recorded after the workflow for this commit finishes.
