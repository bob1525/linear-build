"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { batchIssuesAction } from "@/lib/actions/batch";
import { BATCH_ERRORS, batchSummary, emptySelection, selectAll, selectionFromPointer, type BatchOp, type BatchResult, type SelectionState } from "@/lib/batch";
import { STATUSES, type Status } from "@/lib/constants";
import { hasActiveFilters, type IssueFilters } from "@/lib/filters";
import { compareIssues, groupByStatus } from "@/lib/issue-view";
import type { IssueSort, ViewType } from "@/lib/view-state";
import type { IssueDTO, LabelDTO, UserDTO } from "@/lib/types";
import { Board } from "@/components/board";
import { ClearFilters } from "@/components/clear-filters";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";
import { IssueList } from "@/components/issue-list";
import { Menu, MenuOption } from "@/components/menu";
import { Button } from "@/components/ui";

export function IssueBrowser({
  issues,
  projectKey,
  view,
  sort,
  members,
  labels,
  filters,
}: {
  issues: IssueDTO[];
  projectKey: string;
  view: ViewType;
  sort: IssueSort;
  members: UserDTO[];
  labels: LabelDTO[];
  filters: IssueFilters;
}) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const patched = useMemo(() => presentIssues(issues, removedIds, statusOverrides), [issues, removedIds, statusOverrides]);
  const ordered = useMemo(() => orderedIssues(patched, view, sort), [patched, view, sort]);
  const orderedIds = useMemo(() => ordered.map((issue) => issue.id), [ordered]);
  const [selection, setSelection] = useState<SelectionState>(emptySelection());
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [verb, setVerb] = useState<"Updated" | "Deleted">("Updated");
  const [confirming, setConfirming] = useState(false);
  const visibleKey = orderedIds.join("|");
  const selected = selection.selected.filter((id) => orderedIds.includes(id));
  const allSelected = orderedIds.length > 0 && orderedIds.every((id) => selected.includes(id));

  useEffect(() => {
    setStatusOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const issue of issues) {
        if (next[issue.id] && next[issue.id] === issue.status) {
          delete next[issue.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setRemovedIds((current) => current.filter((id) => issues.some((issue) => issue.id === id)));
  }, [issues]);

  useEffect(() => {
    const allowed = new Set(visibleKey ? visibleKey.split("|") : []);
    setSelection((current) => {
      const nextSelected = current.selected.filter((id) => allowed.has(id));
      const anchor = current.anchor && allowed.has(current.anchor) ? current.anchor : null;
      if (nextSelected.length === current.selected.length && anchor === current.anchor) return current;
      return { selected: nextSelected, anchor };
    });
  }, [visibleKey]);

  function onSelect(id: string, mods: { shift: boolean; meta: boolean }) {
    setResult(null);
    setSelection((current) => selectionFromPointer(current, orderedIds, id, { shift: mods.shift, toggle: mods.meta }));
  }

  function toggleAll() {
    setResult(null);
    setSelection(allSelected ? emptySelection() : selectAll(orderedIds));
  }

  async function run(op: BatchOp) {
    if (selected.length === 0 || pending) return;
    const deleting = op.type === "delete";
    setPending(true);
    setProgress(`${deleting ? "Deleting" : "Updating"} ${selected.length} ${selected.length === 1 ? "issue" : "issues"}…`);
    setResult(null);
    const versions: Record<string, string> = {};
    for (const id of selected) {
      const issue = ordered.find((item) => item.id === id);
      if (issue) versions[id] = issue.updatedAt;
    }
    const response = await batchIssuesAction({ projectKey, issueIds: selected, op, versions });
    setPending(false);
    setProgress(null);
    if (!response.ok) {
      setVerb(deleting ? "Deleted" : "Updated");
      setResult({ succeeded: [], failed: selected.map((id) => ({ id, key: ordered.find((issue) => issue.id === id)?.key ?? null, error: response.error })) });
      return;
    }
    setVerb(deleting ? "Deleted" : "Updated");
    setResult(response.data);
    const done = new Set(response.data.succeeded.map((item) => item.id));
    const gone = response.data.failed.filter((item) => item.error === BATCH_ERRORS.missing).map((item) => item.id);
    if (deleting || gone.length > 0) {
      setRemovedIds((current) => [...new Set([...current, ...(deleting ? done : []), ...gone])]);
    }
    if (op.type === "status") {
      const status = op.status;
      setStatusOverrides((current) => {
        const next = { ...current };
        for (const item of response.data.succeeded) next[item.id] = status;
        return next;
      });
    }
    setSelection((current) => ({
      selected: current.selected.filter((id) => !done.has(id)),
      anchor: current.anchor && !done.has(current.anchor) ? current.anchor : null,
    }));
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 sm:px-4" aria-busy={pending}>
        <button
          type="button"
          data-testid="select-all"
          aria-pressed={allSelected}
          onClick={toggleAll}
          className="h-7 rounded-md px-2 text-[12px] text-ink-muted hover:bg-white/5 hover:text-ink"
        >
          {allSelected ? "Clear selection" : "Select all"}
        </button>
        {selected.length > 0 ? (
          <>
            <span data-testid="selection-count" className="text-[12px] text-ink">
              {selected.length} selected
            </span>
            <Menu
              label="Batch status"
              testId="batch-status"
              trigger={<span className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[12px]">Status</span>}
            >
              {STATUSES.map((status) => (
                <MenuOption key={status.id} onSelect={() => void run({ type: "status", status: status.id })}>
                  <span data-testid={`batch-status-${status.id}`}>{status.label}</span>
                </MenuOption>
              ))}
            </Menu>
            <Menu
              label="Batch assignee"
              testId="batch-assignee"
              trigger={<span className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[12px]">Assignee</span>}
            >
              <MenuOption onSelect={() => void run({ type: "assignee", assigneeId: null })}>Unassigned</MenuOption>
              {members.map((member) => (
                <MenuOption key={member.id} onSelect={() => void run({ type: "assignee", assigneeId: member.id })}>
                  {member.name}
                </MenuOption>
              ))}
            </Menu>
            <Menu
              label="Batch add label"
              testId="batch-add-label"
              trigger={<span className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[12px]">Add label</span>}
            >
              {labels.map((label) => (
                <MenuOption key={label.id} onSelect={() => void run({ type: "add_label", labelId: label.id })}>
                  {label.name}
                </MenuOption>
              ))}
            </Menu>
            <Menu
              label="Batch remove label"
              testId="batch-remove-label"
              trigger={<span className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[12px]">Remove label</span>}
            >
              {labels.map((label) => (
                <MenuOption key={label.id} onSelect={() => void run({ type: "remove_label", labelId: label.id })}>
                  {label.name}
                </MenuOption>
              ))}
            </Menu>
            <button
              type="button"
              data-testid="batch-delete"
              onClick={() => setConfirming(true)}
              className="h-7 rounded-md px-2 text-[12px] text-red-200 hover:bg-red-500/10"
            >
              Delete
            </button>
          </>
        ) : (
          <span className="text-[12px] text-ink-faint">Shift or Ctrl/Cmd click to select</span>
        )}
        {progress ? (
          <span data-testid="batch-progress" className="text-[12px] text-ink-muted">
            {progress}
          </span>
        ) : null}
      </div>
      {result ? (
        <div data-testid="batch-result" className="border-b border-line px-4 py-2 text-[12px]">
          <p className="text-ink">
            {verb} · {batchSummary(result)}
          </p>
          {result.succeeded.length > 0 ? <p className="mt-1 text-ink-muted">{result.succeeded.map((item) => item.key).join(", ")}</p> : null}
          {result.failed.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-red-200">
              {result.failed.map((item) => (
                <li key={item.id} data-testid={`batch-failed-${item.key ?? item.id}`}>
                  {item.key ?? "Unknown issue"}: {item.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {ordered.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title="No issues match these filters"
            body="Status, priority, assignee, and label filters combine. Clear them to see the full project again."
            action={hasActiveFilters(filters) ? <ClearFilters /> : undefined}
          />
        ) : view === "board" ? (
          <Board issues={ordered} projectKey={projectKey} sort={sort} selectedIds={selected} onSelect={onSelect} />
        ) : (
          <IssueList issues={ordered} projectKey={projectKey} sort={sort} selectedIds={selected} onSelect={onSelect} />
        )}
      </div>
      {confirming ? (
        <Dialog
          title="Delete issues"
          description={`Delete ${selected.length} ${selected.length === 1 ? "issue" : "issues"}? This cannot be undone.`}
          onClose={() => setConfirming(false)}
        >
          <div className="flex justify-end gap-2 px-4 py-3">
            <Button variant="subtle" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                void run({ type: "delete" });
              }}
            >
              Delete issues
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function presentIssues(issues: IssueDTO[], removedIds: string[], statusOverrides: Record<string, Status>) {
  const removed = new Set(removedIds);
  return issues
    .filter((issue) => !removed.has(issue.id))
    .map((issue) => (statusOverrides[issue.id] ? { ...issue, status: statusOverrides[issue.id] } : issue));
}

function orderedIssues(issues: IssueDTO[], view: ViewType, sort: IssueSort) {
  if (view === "list") return [...issues].sort((left, right) => compareIssues(left, right, sort));
  const groups = groupByStatus(issues, sort);
  return STATUSES.flatMap((status) => groups[status.id]);
}
