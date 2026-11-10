"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateIssueAction } from "@/lib/actions/issues";
import { STATUSES, statusLabel, type Status } from "@/lib/constants";
import { compareIssues } from "@/lib/issue-view";
import type { IssueSort } from "@/lib/view-state";
import { formatDueDate, isOverdue } from "@/lib/format";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, LabelPill } from "@/components/avatar";
import { BlockingMarks } from "@/components/blocking-marks";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { ConflictPrompt } from "@/components/conflict-prompt";
import { Menu, MenuOption } from "@/components/menu";

export function IssueList({
  issues,
  projectKey,
  sort,
  selectedIds = [],
  onSelect,
}: {
  issues: IssueDTO[];
  projectKey: string;
  sort: IssueSort;
  selectedIds?: string[];
  onSelect?: (id: string, mods: { shift: boolean; meta: boolean }) => void;
}) {
  const router = useRouter();
  const sorted = [...issues].sort((left, right) => compareIssues(left, right, sort));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ issueId: string; status: Status; actorName: string | null } | null>(null);
  const [overwritePending, setOverwritePending] = useState(false);

  async function overwrite() {
    if (!conflict) return;
    const move = conflict;
    setOverwritePending(true);
    const result = await updateIssueAction({ issueId: move.issueId, status: move.status, overwrite: true });
    setOverwritePending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConflict(null);
    setError(null);
    router.refresh();
  }

  return (
    <div className="h-full overflow-auto">
      {conflict ? (
        <ConflictPrompt
          actorName={conflict.actorName}
          pending={overwritePending}
          onReload={() => {
            setConflict(null);
            router.refresh();
          }}
          onOverwrite={() => void overwrite()}
        />
      ) : null}
      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </p>
      ) : null}
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[28px_28px_84px_minmax(0,1fr)_148px_180px_96px_36px] gap-2 border-b border-line px-4 py-2 text-[11px] uppercase tracking-wide text-ink-faint">
          <span />
          <span />
          <span>ID</span>
          <span>Title</span>
          <span>Status</span>
          <span>Labels</span>
          <span>Due</span>
          <span />
        </div>
        <ul>
          {sorted.map((issue) => (
            <li
              key={issue.id}
              data-testid={`row-${issue.key}`}
              data-blocked={issue.blockedByCount > 0 ? "true" : "false"}
              data-blocks={issue.blocksCount > 0 ? "true" : "false"}
              data-selected={selectedIds.includes(issue.id) ? "true" : "false"}
              onClickCapture={
                onSelect
                  ? (event) => {
                      if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect(issue.id, { shift: event.shiftKey, meta: event.metaKey || event.ctrlKey });
                    }
                  : undefined
              }
              className={cn(
                "grid grid-cols-[28px_28px_84px_minmax(0,1fr)_148px_180px_96px_36px] items-center gap-2 border-b border-line px-4 py-2 hover:bg-white/[0.03]",
                selectedIds.includes(issue.id) && "bg-accent/10",
              )}
            >
              {onSelect ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(issue.id)}
                  aria-label={`Select ${issue.key}`}
                  data-testid={`select-${issue.key}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(issue.id, { shift: event.shiftKey, meta: event.metaKey || event.ctrlKey });
                  }}
                  className={cn(
                    "h-4 w-4 rounded border border-line",
                    selectedIds.includes(issue.id) ? "border-accent bg-accent" : "bg-black/20 hover:border-ink-faint",
                  )}
                />
              ) : (
                <span />
              )}
              <PriorityIcon priority={issue.priority} />
              <Link href={`/p/${projectKey}/issues/${issue.number}`} className="font-mono text-[12px] text-ink-faint hover:text-ink">
                {issue.key}
              </Link>
              <div className="flex min-w-0 items-center gap-2">
                <Link href={`/p/${projectKey}/issues/${issue.number}`} className="truncate text-[13px] font-medium hover:text-white" title={issue.title}>
                  {issue.title}
                </Link>
                <BlockingMarks issue={issue} />
              </div>
                <StatusControl issue={issue} onError={setError} onConflict={setConflict} />
              <div className="flex min-w-0 gap-1 overflow-hidden">
                {issue.labels.slice(0, 2).map((label) => (
                  <LabelPill key={label.id} name={label.name} color={label.color} />
                ))}
              </div>
              <span className={cn("text-[12px]", isOverdue(issue.dueDate, issue.status) ? "text-red-300" : "text-ink-faint")}>
                {issue.dueDate ? formatDueDate(issue.dueDate) : "—"}
              </span>
              <span className="justify-self-end">
                {issue.assignee ? <Avatar name={issue.assignee.name} /> : <span className="block h-5 w-5 rounded-full border border-dashed border-line" />}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusControl({
  issue,
  onError,
  onConflict,
}: {
  issue: IssueDTO;
  onError: (message: string | null) => void;
  onConflict: (conflict: { issueId: string; status: Status; actorName: string | null }) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(issue.status);
  const [version, setVersion] = useState(issue.updatedAt);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(issue.status);
  }, [issue.status]);

  useEffect(() => {
    setVersion(issue.updatedAt);
  }, [issue.updatedAt]);

  function choose(next: Status) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const result = await updateIssueAction({ issueId: issue.id, status: next, baseUpdatedAt: version });
      if (!result.ok) {
        setStatus(previous);
        if (result.conflict) onConflict({ issueId: issue.id, status: next, actorName: result.conflict.actorName });
        else onError(result.error);
        return;
      }
      setVersion(result.data.updatedAt);
      onError(null);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
    <Menu
      label={`Change status for ${issue.key}`}
      testId={`status-${issue.key}`}
      trigger={
        <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] hover:bg-white/5", pending && "opacity-60")}>
          <StatusIcon status={status} />
          {statusLabel(status)}
        </span>
      }
    >
      {STATUSES.map((item) => (
        <MenuOption key={item.id} selected={item.id === status} onSelect={() => choose(item.id)}>
          <span className="inline-flex items-center gap-2">
            <StatusIcon status={item.id} />
            {item.label}
          </span>
        </MenuOption>
      ))}
    </Menu>
    {pending ? (
      <span data-testid={`status-saving-${issue.key}`} className="text-[11px] text-ink-faint">
        Saving…
      </span>
    ) : null}
    </span>
  );
}
