# Optional Postgres path

SQLite stays the default. A `postgresql://` or `postgres://` `DATABASE_URL` uses a second Prisma schema and its own migration history. The SQLite files in `prisma/migrations`, `npm run db:migrate`, and the current tests stay on SQLite.

## What was done

`prisma/postgres/schema.prisma` has the same models as `prisma/schema.prisma` and `provider = "postgresql"`. Its client is generated to `node_modules/@prisma-postgres/client`, so it does not replace the SQLite client in `@prisma/client`. `prisma/postgres/migrations/20261127120000_init/migration.sql` is the output of `prisma migrate diff --from-empty --to-schema-datamodel prisma/postgres/schema.prisma --script`. `prisma/postgres/migrations/migration_lock.toml` pins `postgresql`. The SQL in `prisma/migrations` is still SQLite.

`npm run db:migrate:pg` runs `scripts/apply-postgres-migrations.ts`. It applies that history with `prisma migrate deploy --schema prisma/postgres/schema.prisma`, then checks the database against the Postgres schema with `prisma migrate diff --exit-code`. A URL that does not start with `postgresql://` or `postgres://` stops before Prisma runs, and the message points back at `npm run db:migrate`. `npm run db:setup:pg` is that command followed by the existing seed.

`src/lib/create-prisma.ts` reads `DATABASE_URL` when the client is constructed. A Postgres URL builds the generated Postgres client and passes the URL through. Any other URL, including the default `file:` URL, is `new PrismaClient()` from `@prisma/client`. `src/lib/db.ts` and `prisma/seed.ts` use that helper. `scripts/seed-perf.ts` and `scripts/apply-migrations.ts` still construct the SQLite client themselves. `npm run db:e2e` and `npm run db:perf` are unchanged.

`postinstall` still generates the SQLite client. It then generates the Postgres client with a dummy `postgresql://127.0.0.1:5432/northstar` for that one command, so generate can validate while `.env` points at a SQLite file. Generate does not open a connection. The generated directory is not committed. `next.config.ts` keeps `@prisma-postgres/client` external so the production build does not bundle its query engine.

The rate-limit insert is still one statement. The derived table is named `slots`, which Postgres requires and SQLite accepts. Each fragment is built with the Prisma client that executes the statement. The app client’s TypeScript type remains the SQLite client. The Postgres instance is cast to it. `tests/unit/postgres-path.test.ts` compares the model text of the two schemas, so a field that exists on only one side fails the suite.

## How to switch

Install and start Postgres yourself. This repository does not install a server.

```bash
npm ci
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/northstar"
npm run db:migrate:pg
npm run build
npm run start
```

`npm run db:setup:pg` also loads the demo workspace, including `ava@northstar.dev` / `demo1234`. Skip it on a database that should not contain that data. Changing `DATABASE_URL` applies to the next process start. The client is chosen when the module loads.

Set `DATABASE_URL` back to a `file:` path and use `npm run db:migrate` to run SQLite again. Both clients are already generated. Nothing copies rows from the SQLite file into Postgres.

## How it was verified

2026-11-27, on `a85536f` plus this change. Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npm run typecheck` | Pass |
| `npm test` | **125 passed** (18 files). The previous suite was 122 in 17 files. Three tests were added |
| `npm run test:e2e` | **58 passed** (1.3 minutes) after the search retry below. The same suite had passed in 1.8 minutes before that change. The SQLite e2e database still migrated and seeded 4 users, 4 projects, and 67 issues. The production build compiled with the Postgres client external. `shows which issue failed when part of a batch no longer exists` passed on the first attempt (1.7 seconds) |

`tests/unit/postgres-path.test.ts` checks:

- The model text of `prisma/schema.prisma` and `prisma/postgres/schema.prisma` matches. The SQLite lock stays `sqlite` and its init SQL contains `DATETIME`. The Postgres lock is `postgresql`, and its init SQL contains `TIMESTAMP(3)` and `RateLimitEvent` and does not contain `DATETIME`.
- `db:migrate:pg` with `file:./dev.db` exits before applying a migration.
- Against embedded Postgres, the first deploy applies `20261127120000_init`, the drift check passes, and the second deploy reports no pending migrations. The seed then creates Ava Chen and more than 10 issues. `_prisma_migrations` contains only that migration. Eight failed sign-ins for one email are stored, the ninth returns false and leaves the count at 8, and one successful sign-in is stored in `login-success-email`.

`tests/unit/migrations.test.ts` and `tests/unit/auth-limits.test.ts` passed unchanged, including the two-client SQLite burst.

## Problems found

This machine has no `psql`, no Postgres package, and no Docker. The live test uses `@electric-sql/pglite` and `@electric-sql/pglite-socket` as an embedded server. That is the test double. A deploy uses a real `postgresql://` URL.

The first rate-limit insert sent to that server failed with Postgres `42601`, `syntax error at or near "$1"`. `Prisma.sql` fragments built by the SQLite client were bound as one value by the Postgres client, so the statement was `SELECT … FROM ( $1 )`. `instanceof` could not tell the clients apart: a client constructed from `@prisma-postgres/client` is not `instanceof` that same export. The instance’s `_activeProvider` is `postgresql` or `sqlite`, and the fragment builder follows that. The derived table also needed `AS "slots"`. An unnamed subquery is valid SQLite and invalid Postgres.

`execFileSync` from the test process blocked the event loop, so the embedded server stayed in `LISTEN` and Prisma reported `P1001` (`Can't reach database server`) after its connect timeout. The test awaits `execFile` instead, which leaves the loop free to accept the connection. `db:migrate:pg` itself stays synchronous. A real Postgres server is another process and accepts connections while Node is blocked.

A second Prisma client against the same embedded server failed with `42P05`, `prepared statement "s0" already exists`. PGlite answers every connection from one session, so the seed’s named statement was still there. The test URL adds `pgbouncer=true`, which makes Prisma skip named statements, and `connection_limit=1`. A real Postgres server keeps prepared statements on the connection that created them and does not need `pgbouncer=true`.

Push [46024345954](https://github.com/bob1525/linear-build/actions/runs/46024345954) on `152e3c8` passed with 125 unit tests and 58 end-to-end tests, and no retry. The pull request run of that same commit, [46024361115](https://github.com/bob1525/linear-build/actions/runs/46024361115), passed only because Playwright retried once. `shows which issue failed when part of a batch no longer exists` filled the search box and the URL stayed `http://127.0.0.1:3100/p/ORB` for 10 seconds instead of gaining `q=Batch…`. The retry passed in 2.6 seconds. The page was already hydrated: the test had just used the new-issue dialog. That dialog’s save calls `router.refresh()` and does not wait for it. The search box waits 200ms and then calls `router.push` inside `startTransition`. A push started while the refresh is in flight can be dropped, and nothing issued it again. The search box now commits once more, 250ms later, if the query is still missing. A further keystroke clears that timer.

Evidence push [46026046733](https://github.com/bob1525/linear-build/actions/runs/46026046733) on `e8bf337` passed with 125 unit tests and 58 end-to-end tests, and no retry. The pull request run of that same commit, [46026061020](https://github.com/bob1525/linear-build/actions/runs/46026061020), failed. `signs up, creates a project, and shows the empty board` stayed on `http://127.0.0.1:3100/welcome` for 10 seconds on the first attempt and on the retry, instead of opening `/p/LNP`. The project action had already revalidated. The form then called `router.push` and `router.refresh` together, and the refresh can cancel the push. A cancelled first attempt still stores the project, so the retry hits “That project key is already in use” and stays on the welcome page too. The form now only pushes. The same run also retried `the later saver of an issue gets a conflict prompt` once: the title was still the joined draft, then the retry passed in 3.4 seconds. That retry is not a pass. The push of the same commit did not hit it.

## Remaining limitations

- SQLite stays the default. `npm run db:migrate`, `db:setup`, `db:e2e`, and `db:perf` apply only `prisma/migrations`. `npm run db:push` still does not record history.
- Nothing copies an existing SQLite file into Postgres. `db:migrate:pg` creates the empty schema. The demo rows appear only if you run the seed.
- The two schema files can drift. The model-text test fails the unit job when they do. The app’s TypeScript type is the SQLite client, so a one-sided field is not a type error.
- The embedded server is not a production database. CI runs that test inside the existing unit job. There is no Postgres service in GitHub Actions. The parallel burst is still the SQLite test with two clients. The embedded test uses one connection and checks the same statement: eight failure rows, a refused ninth, and one success row.
- Several Node processes can share one Postgres database, including `RateLimitEvent`. They still cannot share one SQLite file.
- There is still no email verification and no forgot-password flow. The success caps, the failure caps, and `TRUST_PROXY` are unchanged.

## Actions run

Push of `d1fcb40`: [46025536154](https://github.com/bob1525/linear-build/actions/runs/46025536154), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:30:39Z to 15:31:43Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:30:39Z to 15:33:31Z. **58 passed** (1.6 minutes).

Pull request of the same commit: [46025550052](https://github.com/bob1525/linear-build/actions/runs/46025550052), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:30:45Z to 15:31:56Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:30:44Z to 15:33:36Z. **58 passed** (1.6 minutes). `shows which issue failed when part of a batch no longer exists` passed on the first attempt (6.3 seconds).

Performance on the same commit, not required: [46025550099](https://github.com/bob1525/linear-build/actions/runs/46025550099), conclusion success. Board-load median 475 ms, `status=ok`. List-load median 448 ms, 19 mounted at the top and 19 at the end.

Push of `a81b4d2`: [46026996025](https://github.com/bob1525/linear-build/actions/runs/46026996025), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:40:32Z to 15:41:24Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:40:32Z to 15:43:09Z. **58 passed** (1.3 minutes). `signs up, creates a project, and shows the empty board` passed on the first attempt (516 ms). `the later saver of an issue gets a conflict prompt` passed on the first attempt (3.2 seconds).

Pull request of the same commit: [46027006695](https://github.com/bob1525/linear-build/actions/runs/46027006695), conclusion success. No flaky test and no retry.

- `Lint, typecheck, and unit tests`: 2026-11-27 15:40:36Z to 15:41:22Z. **125 passed** (18 files).
- `Playwright`: 2026-11-27 15:40:36Z to 15:43:35Z. **58 passed** (1.7 minutes). The signup test passed on the first attempt (613 ms). The conflict test passed on the first attempt (3.4 seconds).

Performance on the same commit, not required: [46027006663](https://github.com/bob1525/linear-build/actions/runs/46027006663), conclusion success. Board-load median 425 ms, `status=ok`. List-load median 405 ms, 19 mounted at the top and 18 at the end.
