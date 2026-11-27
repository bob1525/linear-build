# Migrations

The optional Postgres history is in [POSTGRES_PATH.md](POSTGRES_PATH.md). This file is the SQLite history.

The schema used to be applied only with `prisma db push`. An existing SQLite file had no migration history, so the `RateLimitEvent` table from the previous stage could not be added by `prisma migrate deploy`.

## What was done

`prisma/migrations` now has two SQLite migrations:

- `20261127100000_init` creates the tables that existed before `RateLimitEvent`.
- `20261127100100_rate_limit_event` creates `RateLimitEvent` and its index.

The SQL is the output of `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`, split so the rate-limit table is its own step. `migration_lock.toml` pins the provider to `sqlite`.

`npm run db:migrate` runs `scripts/apply-migrations.ts`.

- On an empty file, `prisma migrate deploy` applies both migrations.
- On a non-empty file with no `_prisma_migrations` table (the old `db push` case), deploy returns P3005. If the baseline tables are all present, the script marks `20261127100000_init` applied. If `RateLimitEvent` is already there, it marks that migration applied too. If the table is missing, the following deploy creates it.
- If any baseline table is missing, the script prints the missing names and does not mark a migration applied.
- After a successful deploy it runs `prisma migrate diff` from the database to `prisma/schema.prisma` and exits if they differ.

`npm run db:setup` is that command followed by the existing seed. `db:e2e` and `db:perf` delete their own files and then use the same migrate command instead of `db push`. `npm run db:push` is still in `package.json` and still does not record history. Setup and deploy do not call it.

SQLite stays the default. `npm run db:migrate` applies only the SQLite files in `prisma/migrations`. The Postgres schema and its own migration history are in [POSTGRES_PATH.md](POSTGRES_PATH.md).

Seed still reads `DATABASE_URL`. If it is unset, `scripts/load-env.ts` reads it from `.env`, which is the file `cp .env.example .env` creates. A variable already set in the environment wins, so the e2e `file:./e2e.db` override is unchanged.

## Verification

2026-11-27, Node v22.23.4.

| Check | Result |
| --- | --- |
| `npm run lint` | Pass. No ESLint warnings or errors |
| `npx tsc --noEmit` | Pass |
| `npm test` | **87/87** (12 files). The new file is `tests/unit/migrations.test.ts`, 4 tests. The previous 83 still pass. `tests/unit/auth-limits.test.ts` now builds its temporary file with `prisma migrate deploy` instead of `db push`. Its assertions are unchanged |
| `npm run test:e2e` | **46 passed** (1.3 minutes). `db:e2e` applied both migrations, then the seed reported 4 users, 4 projects, and 67 issues. The keyboard test passed on the first attempt (410 ms). No flaky test |

`tests/unit/migrations.test.ts`:

- An empty file ends with both migration names and a `RateLimitEvent` table. Running the script again finds nothing pending.
- A file that has only the init SQL is baselined, then `20261127100100_rate_limit_event` is applied.
- A file that already has both the init tables and `RateLimitEvent`, and no `_prisma_migrations` table, marks both migrations applied.
- A file whose only table is `Other` throws `missing User` and is not baselined.

`DATABASE_URL=file:/tmp/northstar-setup/fresh.db npm run db:setup` applied both migrations and seeded 4 users, 4 projects, and 67 issues. A second file was created from the init SQL only. `npm run db:setup` printed `Baselined 20261127100000_init` and `Applying migration 20261127100100_rate_limit_event`, then seeded the same 4 users, 4 projects, and 67 issues. Both files listed both migration names, and `RateLimitEvent` was empty after the seed.

## Problems found

The first `npm run test:e2e` applied the migrations and then failed the drift check with Prisma P1003, `Database e2e.db does not exist`. `migrate deploy` resolves `file:./e2e.db` from the `prisma/` directory. `migrate diff --from-url` resolved the same string from the project root. The script now turns a relative SQLite URL into an absolute `file:` path under `prisma/` before the diff. The e2e run after that change seeded and passed. Absolute URLs, which the unit tests use, were already found.

## Remaining manual steps

- Back up a file that has real rows before `npm run db:migrate`. The drift check runs after the history is recorded. If it fails, stop and restore the backup. Do not keep using a file the check rejected.
- A SQLite file that is missing one of the baseline tables is not upgraded. The script names the missing tables and leaves the file without a migration history. That file is not a Northstar database this repo can baseline.
- `npm run db:push` still updates a file without writing `_prisma_migrations`. Do not use it for a database that should stay on this history.
- These migrations are SQLite. They do not run on Postgres. A multi-instance database would need a new provider, a new `DATABASE_URL`, and a new migration history. That port is not in this stage. One `next start` process remains the deploy that matches this file.
- `npm run db:setup` still reseeds the demo workspace. Do not point it at a production file.

## Actions run

Push of `ec6c5c7`: [45980715722](https://github.com/bob1525/linear-build/actions/runs/45980715722), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:16:38Z to 10:17:26Z. **87 passed**.
- `Playwright`: 2026-11-27 10:16:39Z to 10:19:24Z. **46 passed** (1.4 minutes). No flaky test. The keyboard test passed on the first attempt (516 ms).

Pull request of the same commit: [45980725676](https://github.com/bob1525/linear-build/actions/runs/45980725676), conclusion success.

- `Lint, typecheck, and unit tests`: 2026-11-27 10:16:42Z to 10:17:48Z. **87 passed**.
- `Playwright`: 2026-11-27 10:16:42Z to 10:19:30Z. **46 passed** (1.4 minutes). No flaky test. The keyboard test passed on the first attempt (518 ms).
