"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { updateIssueAction } from "@/lib/actions/issues";
import { STATUSES, isStatus, statusLabel, type Status } from "@/lib/constants";
import { groupByStatus } from "@/lib/issue-view";
import type { IssueSort } from "@/lib/view-state";
import { kanbanCollision } from "@/lib/kanban-collision";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { IssueCard } from "@/components/issue-card";
import { StatusIcon } from "@/components/icons";

type PendingMove = { status: Status; previous: Status; ticket: number };

export function Board({ issues, projectKey, sort }: { issues: IssueDTO[]; projectKey: string; sort: IssueSort }) {
  const router = useRouter();
  const [items, setItems] = useState(issues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const pendingRef = useRef(new Map<string, PendingMove>());
  const ticketRef = useRef(0);
  const chainRef = useRef(Promise.resolve());
  const draggingRef = useRef(false);
  const wantsRefreshRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  itemsRef.current = items;

  function maybeRefresh() {
    if (draggingRef.current || pendingRef.current.size > 0) {
      wantsRefreshRef.current = true;
      return;
    }
    if (!wantsRefreshRef.current) return;
    wantsRefreshRef.current = false;
    router.refresh();
  }

  useEffect(() => {
    setItems(issues.map((issue) => {
      const pending = pendingRef.current.get(issue.id);
      return pending ? { ...issue, status: pending.status } : issue;
    }));
  }, [issues]);

  const groups = groupByStatus(items, sort);
  const active = items.find((issue) => issue.id === activeId) ?? null;

  function onDragEnd(event: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    const issueId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!overId) {
      maybeRefresh();
      return;
    }
    const nextStatus = isStatus(overId) ? overId : itemsRef.current.find((issue) => issue.id === overId)?.status;
    if (!nextStatus) {
      maybeRefresh();
      return;
    }
    const current = itemsRef.current.find((issue) => issue.id === issueId);
    if (!current || current.status === nextStatus) {
      maybeRefresh();
      return;
    }

    const ticket = ++ticketRef.current;
    const previous = current.status;
    pendingRef.current.set(issueId, { status: nextStatus, previous, ticket });
    const nextItems = itemsRef.current.map((issue) => (issue.id === issueId ? { ...issue, status: nextStatus } : issue));
    itemsRef.current = nextItems;
    setItems(nextItems);

    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await updateIssueAction({ issueId, status: nextStatus });
        const pending = pendingRef.current.get(issueId);
        if (!pending || pending.ticket !== ticket) return;
        pendingRef.current.delete(issueId);
        if (!result.ok) {
          setItems((currentItems) => currentItems.map((issue) => (issue.id === issueId ? { ...issue, status: previous } : issue)));
          setError(result.error);
          maybeRefresh();
          return;
        }
        setError(null);
        wantsRefreshRef.current = true;
        maybeRefresh();
      });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      autoScroll={{ threshold: { x: 0.12, y: 0.12 } }}
      onDragStart={(event) => {
        draggingRef.current = true;
        setActiveId(String(event.active.id));
      }}
      onDragCancel={() => {
        draggingRef.current = false;
        setActiveId(null);
        maybeRefresh();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full min-h-0 flex-col">
        {error ? (
          <p role="alert" className="mx-4 mt-3 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            {error}
          </p>
        ) : null}
        <div data-testid="board-scroll" className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 pb-4 pt-3 sm:px-4">
          {STATUSES.map((status) => (
            <Column key={status.id} status={status.id} issues={groups[status.id]} projectKey={projectKey} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[260px] opacity-80">
            <IssueCard issue={active} projectKey={projectKey} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, issues, projectKey }: { status: Status; issues: IssueDTO[]; projectKey: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      data-drop-target={isOver ? "true" : "false"}
      className={cn(
        "flex h-full w-[78vw] max-w-[320px] shrink-0 flex-col rounded-xl bg-white/[0.025] sm:w-[300px] xl:w-auto xl:min-w-[240px] xl:flex-1",
        isOver && "bg-accent/15 ring-2 ring-inset ring-accent",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusIcon status={status} />
        <h2 className="text-[13px] font-medium">{statusLabel(status)}</h2>
        <span className="text-[12px] tabular-nums text-ink-faint">{issues.length}</span>
      </header>
      <div data-testid={`column-scroll-${status}`} data-column-scroll="true" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {isOver ? <div data-testid={`drop-slot-${status}`} className="h-1.5 shrink-0 rounded-full bg-accent" /> : null}
        {issues.length === 0 ? (
          <p className={cn("px-2 py-8 text-center text-[12px]", isOver ? "text-accent-hover" : "text-ink-faint")}>
            {isOver ? "Drop here" : "No issues"}
          </p>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} projectKey={projectKey} />)
        )}
      </div>
    </section>
  );
}
