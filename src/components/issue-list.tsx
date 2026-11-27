"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateIssueAction } from "@/lib/actions/issues";
import { STATUSES, priorityLabel, statusLabel, type Status } from "@/lib/constants";
import { compareIssues } from "@/lib/issue-view";
import { listWindow } from "@/lib/list-window";
import type { IssueSort } from "@/lib/view-state";
import { formatDueDate, isOverdue } from "@/lib/format";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, LabelPill } from "@/components/avatar";
import { BlockingMarks } from "@/components/blocking-marks";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { ConflictPrompt } from "@/components/conflict-prompt";
import { Menu, MenuOption } from "@/components/menu";
import { focusRing } from "@/components/ui";
import { useWindowFocus, windowKeyAction } from "@/components/use-window-focus";

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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ issueId: string; status: Status; actorName: string | null } | null>(null);
  const [overwritePending, setOverwritePending] = useState(false);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const hintId = useId();

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const sync = () => {
      frame = 0;
      setViewport((current) => (current === el.clientHeight ? current : el.clientHeight));
      setScrollTop((current) => (current === el.scrollTop ? current : el.scrollTop));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };
    sync();
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function measure(id: string, node: HTMLLIElement | null) {
    if (!node) return;
    const height = node.offsetHeight;
    if (height <= 0) return;
    setHeights((current) => {
      const previous = current[id];
      if (previous !== undefined && Math.abs(previous - height) < 1) return current;
      return { ...current, [id]: height };
    });
  }

  const layout = listWindow({
    count: sorted.length,
    scrollTop,
    viewport,
    heights: sorted.map((issue) => heights[issue.id]),
    pinIndexes: keyboardIndex === null ? undefined : [keyboardIndex],
  });
  const focusAt = useWindowFocus(scrollerRef, layout.offsets);
  const moveToRef = useRef<(index: number) => void>(() => undefined);
  moveToRef.current = (index: number) => {
    setKeyboardIndex(index);
    focusAt(index);
  };

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const action = windowKeyAction(event.nativeEvent, sorted.length);
    if (!action || action.type !== "move") return;
    event.preventDefault();
    moveToRef.current(action.index);
  }

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
    <div className="flex h-full min-h-0 flex-col">
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto">
        <div className="flex h-full min-w-[720px] flex-col">
        <div className="grid shrink-0 grid-cols-[28px_28px_84px_minmax(0,1fr)_148px_180px_96px_36px] gap-2 border-b border-line px-4 py-2 text-[11px] uppercase tracking-wide text-ink-faint">
          <span />
          <span />
          <span>ID</span>
          <span>Title</span>
          <span>Status</span>
          <span>Labels</span>
          <span>Due</span>
          <span />
        </div>
        <div
          ref={scrollerRef}
          role="region"
          aria-label={`Issue list, ${sorted.length} issues`}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            setKeyboardIndex(null);
          }}
          data-testid="list-scroll"
          data-virtualized={layout.virtualized ? "true" : "false"}
          data-rendered-count={layout.indexes.length}
          data-window-end={layout.end}
          data-list-size={sorted.length}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ overflowAnchor: "none" }}
        >
        <p id={hintId} className="sr-only">
          Use the arrow keys, Home, and End to move between issues. An issue that is off screen is shown when you move to it.
        </p>
        <ul className="relative w-full shrink-0" style={{ height: layout.total }}>
          {layout.indexes.map((index) => {
            const issue = sorted[index];
            if (!issue) return null;
            return (
            <li
              key={issue.id}
              ref={(node) => measure(issue.id, node)}
              data-testid={`row-${issue.key}`}
              data-blocked={issue.blockedByCount > 0 ? "true" : "false"}
              data-blocks={issue.blocksCount > 0 ? "true" : "false"}
              data-selected={selectedIds.includes(issue.id) ? "true" : "false"}
              data-window-index={index}
              aria-setsize={sorted.length}
              aria-posinset={index + 1}
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
                "absolute inset-x-0 grid grid-cols-[28px_28px_84px_minmax(0,1fr)_148px_180px_96px_36px] items-center gap-2 border-b border-line px-4 py-2 hover:bg-white/[0.03]",
                selectedIds.includes(issue.id) && "bg-accent/10",
              )}
              style={{ top: layout.offsets[index] }}
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
                    focusRing,
                    selectedIds.includes(issue.id) ? "border-accent bg-accent" : "bg-black/20 hover:border-ink-faint",
                  )}
                />
              ) : (
                <span />
              )}
              <span className="inline-flex items-center">
                <PriorityIcon priority={issue.priority} />
                <span className="sr-only">Priority: {priorityLabel(issue.priority)}</span>
              </span>
              <Link href={`/p/${projectKey}/issues/${issue.number}`} className={cn("font-mono text-[12px] text-ink-faint hover:text-ink", focusRing)}>
                {issue.key}
              </Link>
              <div className="flex min-w-0 items-center gap-2">
                <Link data-issue-focus="" href={`/p/${projectKey}/issues/${issue.number}`} className={cn("truncate text-[13px] font-medium hover:text-white", focusRing)} title={issue.title}>
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
                {isOverdue(issue.dueDate, issue.status) ? <span className="sr-only">, overdue</span> : null}
              </span>
              <span className="justify-self-end">
                {issue.assignee ? <Avatar name={issue.assignee.name} /> : <span role="img" aria-label="Unassigned" className="block h-5 w-5 rounded-full border border-dashed border-line" />}
              </span>
            </li>
            );
          })}
        </ul>
        </div>
        </div>
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
