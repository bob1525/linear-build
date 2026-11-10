"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { updateIssueAction } from "@/lib/actions/issues";
import { STATUSES, isStatus, statusLabel, type Status } from "@/lib/constants";
import { groupByStatus } from "@/lib/issue-view";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { IssueCard } from "@/components/issue-card";
import { StatusIcon } from "@/components/icons";

export function Board({ issues, projectKey }: { issues: IssueDTO[]; projectKey: string }) {
  const router = useRouter();
  const [items, setItems] = useState(issues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setItems(issues);
  }, [issues]);

  const groups = groupByStatus(items);
  const active = items.find((issue) => issue.id === activeId) ?? null;

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const issueId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!overId) return;
    const nextStatus = isStatus(overId) ? overId : items.find((issue) => issue.id === overId)?.status;
    if (!nextStatus) return;
    const current = items.find((issue) => issue.id === issueId);
    if (!current || current.status === nextStatus) return;

    const previous = items;
    setItems((currentItems) => currentItems.map((issue) => (issue.id === issueId ? { ...issue, status: nextStatus } : issue)));
    startTransition(async () => {
      const result = await updateIssueAction({ issueId, status: nextStatus });
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full min-h-0 flex-col">
        {error ? (
          <p role="alert" className="mx-4 mt-3 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            {error}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 pb-4 pt-3 sm:px-4">
          {STATUSES.map((status) => (
            <Column key={status.id} status={status.id} issues={groups[status.id]} projectKey={projectKey} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-[280px]"><IssueCard issue={active} projectKey={projectKey} overlay /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, issues, projectKey }: { status: Status; issues: IssueDTO[]; projectKey: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={cn(
        "flex h-full w-[78vw] max-w-[320px] shrink-0 flex-col rounded-xl bg-white/[0.025] sm:w-[300px] xl:w-auto xl:min-w-[240px] xl:flex-1",
        isOver && "bg-accent/10 ring-1 ring-inset ring-accent/40",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusIcon status={status} />
        <h2 className="text-[13px] font-medium">{statusLabel(status)}</h2>
        <span className="text-[12px] tabular-nums text-ink-faint">{issues.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {issues.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-ink-faint">No issues</p>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} projectKey={projectKey} />)
        )}
      </div>
    </section>
  );
}
