# Edge cases

Each case below was run in Playwright against a fresh `prisma/e2e.db` (`npm run test:e2e`). The conflict and latency cases are in `e2e/edge.spec.ts`. The empty board is also covered by the original sign-up test.

| Case | What was exercised | Result |
| --- | --- | --- |
| Empty project | Sign up, create a project with a unique key, open the board, then open the list | Pass. Both pages show the heading "No issues yet". |
| Logged-out visit | Open `/p/ORB` with no session | Pass. The browser lands on `/login` and shows "Sign in to Northstar". |
| Non-member | A new account with no membership opens `/p/ORB` | Pass. The page heading is "That page is not in this workspace", with a link back to the caller's projects. |
| Very long text | Type 250 characters into the title field, then save a 200-character title and a description of `detail ` repeated 1200 times plus an end marker (more than 5,000 characters) | Pass. The field stops at 200 characters. The saved title is those 200 characters. The description's end marker is visible on the issue page. |
| Special characters | Create an issue titled with `<script>alert(1)</script>`, quotes, `&`, and `你好`. Comment `Tom & Jerry "quotes" 你好`. Save a view named with `&` and `<view>` | Pass. The title, comment, and view name render as text. No browser dialog fired. |
| Slow network | Delay every server-action POST by 1,000 ms, create two issues, select them, and batch-set status to Done | Pass. The create button reads "Creating…" before the dialog closes. The batch bar reads "Updating 2 issues…" and then "2 succeeded, 0 failed". |
| Later save of the same issue | Ava and Marcus open one issue. Marcus renames it. Ava renames it from the copy she loaded, reloads, then overwrites a second time | Pass. Ava's first save opens "This issue changed" and names Marcus Hale. Reload shows Marcus's title. Overwrite keeps Ava's title after a full reload. Marcus's page still shows his own last title. |

## Loading and errors on the newer features

| Feature | While it is working | When it fails |
| --- | --- | --- |
| Relations | The add button reads "Saving…", the section shows "Saving relation…", and remove buttons are disabled | `relation-error` shows the message. A cycle or a bad key stays on the page. |
| Saved views | Create reads "Saving…". Rename, default, and delete disable their buttons and the panel shows "Working…" | `view-error` shows the message, including a duplicate name. |
| Batch | The bar shows "Updating N issues…" or "Deleting N issues…" and is marked busy | The result lists each failure. A missing issue is removed from the list. A stale `updatedAt` is one of those failures and the matching issues still save. |
| Conflict prompt | Overwrite reads "Saving…" and both buttons are disabled until the write returns | The prompt stays up and shows the error. Reload discards the local edit and fetches the current issue. |
| Title, description, properties, list status | Each shows "Saving…" | The field or the property column shows the error, except a conflict, which uses the prompt instead. |

Unit coverage for the version check is in `tests/unit/concurrency.test.ts` (same version, stale version, overwrite, missing version, prompt copy) and in the batch plan test that holds back one stale issue.
