# Saved views

A saved view is a named snapshot of the board or list a person is looking at: the filters, the sort, and whether that page is the board or the list. Views belong to one user and one project. Two people in the same project never see each other's views, and the same name can exist for each of them.

## Data structure

`SavedView` rows:

| Column | Meaning |
| --- | --- |
| `userId`, `projectId` | Owner and project. Deleting either cascades. |
| `name` | Trimmed label, 1–40 characters |
| `nameKey` | Lowercase name. Unique per user and project, so "Triage" and "triage" collide |
| `viewType` | `board` or `list` |
| `sort` | `priority` (default), `newest` (higher issue number first), `title`, or `due` (undated issues last) |
| `filters` | JSON for status, priority, assignee, label, and keyword. Arrays are stored in sorted order |
| `isDefault` | At most one default per user per project |

The pure rules live in `src/lib/saved-views.ts` and do not touch the database. `createView`, `renameView`, `deleteView`, and `setDefaultView` return a new list and leave the input list unchanged. Setting a default clears the previous default for that person and project only. Clearing a default does not promote another view. A missing id, or an id owned by someone else, is "That view does not exist".

The page URL is the live copy of that state. `viewHref` writes `/p/ORB` or `/p/ORB/list` plus `status`, `priority`, `assignee`, `label`, `q`, `sort` (omitted when it is priority), and `view` (the saved id). A bare project URL with no view query applies the default view once, by redirecting to that href. `?all=1` is the unfiltered board or list, so Clear filters and the sidebar Board and List links do not bounce back to the default.

## Persistence

`createSavedViewAction`, `renameSavedViewAction`, `deleteSavedViewAction`, and `setDefaultSavedViewAction` check the session, require project membership, run the pure rule, then write SQLite. A unique-constraint race returns the same duplicate message. The board and list routes are revalidated.

The issue page header reads that user's rows for the open project. Choosing a view navigates to its href. Refresh keeps the query string, so the filters, sort, and board or list stay put, and the saved row is still in the menu. Signing in again lands on `/p/ORB`, and a default view redirects to its href before the board renders.

Sort is applied inside each status column and in the list. Priority order is unchanged when `sort` is omitted.

## Search shortcut

The Stage 2 `/` failure had a real cause. The search field was rendered inside the project page. That page has a `loading.tsx` boundary, so the shell could already handle `c` and `/` while the field was not in the document. Retrying focus for a few seconds waited on the field and still lost if the loading skeleton was what mounted. The field now lives in the shell, next to the shortcut handler, and is present whenever the handler is. `/` focuses `[data-search]` directly.

## Test list

| Check | Result |
| --- | --- |
| `tsc --noEmit` | pass |
| `next lint` | pass |
| Vitest | 56/56 |
| Playwright | 32/32 |

View unit tests in `tests/unit/saved-views.test.ts`:

| Test | What it checks |
| --- | --- |
| creates a view with its filters, sort, and board or list type | Create stores the trimmed name and does not mutate the input list |
| lists only the caller's views in that project | Another user and another project are omitted |
| rejects an empty name, a long name, and a duplicate ignoring case | Validation, and the list is unchanged |
| allows the same name for another person and another project | Names are unique per user and project |
| renames a view and rejects a taken name | Rename, plus a case-insensitive clash |
| does not rename or delete someone else's view | Cross-user ids are missing |
| deletes a view and reports a missing one | Delete, then a second delete fails |
| keeps a single default per person and project | The previous default clears; other people and projects stay |
| clears a default without promoting another view | No replacement default |
| builds a list url that round-trips filters and sort | Href, default sort, and `all=1` |

`tests/unit/issue-view.test.ts` also checks newest, title, and due ordering. The earlier 45 unit tests still pass.

Playwright, `e2e/views.spec.ts`:

| Test | What it checks |
| --- | --- |
| switching a saved view restores filters, sort, and the list | Todo + High + newest + list is saved, cleared, restored, and still applied after reload |
| keeps saved views private to the user who created them | Ava's views are absent for Marcus, and Marcus's view is absent when Ava signs back in |
| renames a view, opens it as the default after sign-in, and can delete it | Rename, default survives a new sign-in, delete leaves the unfiltered board |

The previous 29 Playwright tests still pass in the same run, including `/` focusing search.
