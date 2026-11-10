# Northstar

Northstar is a lightweight issue tracker for product teams. It covers the everyday loop: sign in, switch projects, filter a board or list, update status, and leave a Markdown comment with an activity trail.

![Sign in](docs/screenshots/login.png)

## Features

- Email and password accounts. Passwords are hashed with bcrypt. Sessions live in an httpOnly cookie.
- Multiple projects, with the last opened project remembered across visits.
- Issues with a title, Markdown description, status, priority, assignee, due date, and labels.
- Status workflow: Backlog, Todo, In Progress, and Done.
- Kanban board with drag-and-drop between columns, plus a list view with inline status changes.
- Issue page with rendered Markdown (including tables), comments, and an activity log of who changed what and when.
- Relations on an issue: blocks, blocked by, and related to, plus one level of sub-issues. Blocking issues are marked on the board and the list. A blocking cycle is rejected.
- Saved views store the current filters, sort, and Board or List choice. Each person has their own views, can rename or delete them, and can mark one as the default for a project.
- Batch edits on the board and the list: Shift or Ctrl/Cmd click, select all, then change status, assignee, or labels, or delete after a confirmation. A partial failure lists the issues that succeeded and the ones that did not. A batch that overlaps a newer save reports that issue as a conflict instead of overwriting it.
- Concurrent edits: the issue page, the list, and a board drag send the version that was loaded. If someone else saved first, the later save stops and a prompt offers to reload their version or overwrite it.
- Filters that combine: status, priority, assignee (including unassigned), label, and keyword search across the key, title, and description. Filters stay in the URL.
- Keyboard shortcuts: `C` opens a new issue, `/` focuses search, `Esc` closes menus and dialogs, and `⌘/Ctrl+Enter` submits the issue and comment composers.
- Empty, loading, and error states for a new workspace, an empty project, a filter with no matches, and a failed page.

## Screenshots

Board, with every status column visible:

![Orbit board](docs/screenshots/board.png)

Filters combine. This view is Todo, High priority, and the keyword `cache`:

![Filtered board](docs/screenshots/filters.png)

List view, sorted by priority:

![Issue list](docs/screenshots/list.png)

Issue detail, with Markdown, comments, properties, and activity:

![Issue detail](docs/screenshots/issue-detail.png)

Board cards mark blocking relationships. ORB-3 blocks ORB-2, so the Todo column shows Blocks and Blocked:

![Board with relation markers](docs/screenshots/board-with-relations.png)

The issue page lists blocked by, blocks, related, the parent, and sub-issues. ORB-1 has ORB-5 as a sub-issue:

![Issue relations and sub-issues](docs/screenshots/issue-detail-relations.png)

Saved views can be named from the current filters and switched later. This one stores Todo, High, and the keyword `cache`:

![Saved views menu](docs/screenshots/saved-views-menu.png)

Selecting more than one issue opens the batch bar for status, assignee, labels, or delete:

![Batch operations](docs/screenshots/batch-operations.png)

If someone else saved the issue first, the later save stops and offers Reload or Overwrite:

![Conflict dialog](docs/screenshots/conflict-dialog.png)

Relay is the drag lab: a long Backlog, one Todo card, an empty In Progress column, and a long Done column:

![Relay drag lab](docs/screenshots/relay-drag-lab.png)

## Tech stack

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS
- Prisma 6 with SQLite
- Zod for input validation
- `@dnd-kit` for board drag-and-drop
- `react-markdown` and `remark-gfm` for descriptions and comments
- Vitest for unit tests, Playwright for end-to-end tests

## Demo credentials

The seed data creates four people, all with the password `demo1234`.

| Name | Email |
| --- | --- |
| Ava Chen | ava@northstar.dev |
| Marcus Hale | marcus@northstar.dev |
| Priya Nair | priya@northstar.dev |
| Leo Park | leo@northstar.dev |

Sign in as Ava to land on **Orbit** (`ORB`). The other seeded projects are **Pulse** (`PLS`), **Atlas** (`ATL`), and **Relay** (`RLY`, a drag lab with a long column, a short column, and an empty column). Together they contain 67 issues, with labels, assignees, due dates, comments, and activity.

The sign-in page includes a **Fill demo** button that enters Ava’s email and password.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Open http://localhost:3000. `db:setup` creates `prisma/dev.db` and loads the demo workspace. `npm install` also generates the Prisma client.

Useful database commands:

```bash
npm run db:generate   # regenerate the Prisma client
npm run db:push       # apply schema changes to the SQLite file
npm run db:seed       # replace the current database with demo data
```

`DATABASE_URL` defaults to `file:./dev.db`, which Prisma resolves relative to the `prisma/` directory.

To refresh the screenshots in `docs/screenshots/` against a running app:

```bash
npm run screenshots
```

That script expects the app at http://127.0.0.1:3000.

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

`npm test` runs the Vitest unit suite (filters, activity copy, validation, ordering, password hashing, kanban column hit-testing, relations, saved views, batch planning, and concurrent-edit checks).

`npm run test:e2e` resets a separate SQLite file (`prisma/e2e.db`), builds the production app, and runs Playwright against http://127.0.0.1:3100. Stop `npm run dev` first. The dev server and the production build share the `.next` directory.

The end-to-end suite covers sign-in and sign-up, combined filters, project switching, list and detail status changes, Markdown comments, creating an issue, dragging a card between columns, relations, saved views, batch edits, the concurrent-edit prompt, empty and unauthorized projects, and the `C` / `/` shortcuts.

`npm run db:perf` builds a separate 500-issue SQLite file (`prisma/perf.db`) for the board timings in `PERFORMANCE.md`. It does not replace the demo seed.
