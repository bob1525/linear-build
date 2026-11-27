"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { updateIssueAction } from "@/lib/actions/issues";
import { STATUSES, isStatus, statusLabel, type Status } from "@/lib/constants";
import { groupByStatus } from "@/lib/issue-view";
import type { IssueSort } from "@/lib/view-state";
import { columnWindow } from "@/lib/column-window";
import { kanbanCollision } from "@/lib/kanban-collision";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ConflictPrompt } from "@/components/conflict-prompt";
import { IssueCard } from "@/components/issue-card";
import { StatusIcon } from "@/components/icons";
import { useWindowFocus, windowKeyAction } from "@/components/use-window-focus";

type PendingMove = { status: Status; previous: Status; ticket: number };

export function Board({
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
  const [items, setItems] = useState(issues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ issueId: string; status: Status; actorName: string | null } | null>(null);
  const [overwritePending, setOverwritePending] = useState(false);
  const itemsRef = useRef(items);
  const pendingRef = useRef(new Map<string, PendingMove>());
  const ticketRef = useRef(0);
  const chainRef = useRef(Promise.resolve());
  const draggingRef = useRef(false);
  const wantsRefreshRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const signature = issues.map((issue) => `${issue.id}:${issue.status}:${issue.updatedAt}`).join("|");
  const [seen, setSeen] = useState(signature);
  if (seen !== signature && pendingRef.current.size === 0 && !draggingRef.current) {
    setSeen(signature);
    setItems(issues);
  }
  itemsRef.current = items;

  async function keepMove() {
    if (!conflict) return;
    const move = conflict;
    setOverwritePending(true);
    const result = await updateIssueAction({ issueId: move.issueId, status: move.status, overwrite: true });
    setOverwritePending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((currentItems) =>
      currentItems.map((issue) =>
        issue.id === move.issueId ? { ...issue, status: move.status, updatedAt: result.data.updatedAt } : issue,
      ),
    );
    setConflict(null);
    setError(null);
    wantsRefreshRef.current = true;
    maybeRefresh();
  }

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
  const movers = useRef(new Map<Status, (index: number) => void>());
  const register = useCallback((status: Status, move: ((index: number) => void) | null) => {
    if (move) movers.current.set(status, move);
    else movers.current.delete(status);
  }, []);
  const hintId = useId();

  function cross(status: Status, direction: -1 | 1, index: number) {
    const ids = STATUSES.map((item) => item.id);
    const at = ids.indexOf(status);
    const nextStatus = ids[at + direction];
    if (!nextStatus) return;
    const count = groups[nextStatus].length;
    if (count === 0) return;
    const column = document.querySelector(`[data-testid="column-${nextStatus}"]`);
    if (column instanceof HTMLElement) column.scrollIntoView({ block: "nearest", inline: "nearest" });
    movers.current.get(nextStatus)?.(Math.min(index, count - 1));
  }

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
    if (!current || current.status === nextStatus || !isStatus(nextStatus)) {
      maybeRefresh();
      return;
    }

    const ticket = ++ticketRef.current;
    const previous = current.status;
    pendingRef.current.set(issueId, { status: nextStatus, previous, ticket });
    setPinnedIds((currentIds) => [...currentIds.filter((id) => id !== issueId), issueId].slice(-8));
    const nextItems = itemsRef.current.map((issue) => (issue.id === issueId ? { ...issue, status: nextStatus } : issue));
    itemsRef.current = nextItems;
    setItems(nextItems);

    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await updateIssueAction({ issueId, status: nextStatus, baseUpdatedAt: current.updatedAt });
        const pending = pendingRef.current.get(issueId);
        if (!pending || pending.ticket !== ticket) return;
        pendingRef.current.delete(issueId);
        if (!result.ok) {
          setItems((currentItems) => currentItems.map((issue) => (issue.id === issueId ? { ...issue, status: previous } : issue)));
          if (result.conflict) {
            setError(null);
            setConflict({ issueId, status: nextStatus, actorName: result.conflict.actorName });
          } else {
            setError(result.error);
          }
          maybeRefresh();
          return;
        }
        setError(null);
        setItems((currentItems) =>
          currentItems.map((issue) =>
            issue.id === issueId ? { ...issue, status: nextStatus, updatedAt: result.data.updatedAt } : issue,
          ),
        );
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
        <p id={hintId} className="sr-only">
          Use the arrow keys to move between cards. Home and End move to the ends of a column. A card that is off screen is shown when you move to it.
        </p>
        <div data-testid="board-scroll" role="region" aria-label="Board" aria-describedby={hintId} className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 pb-4 pt-3 sm:px-4">
          {STATUSES.map((status) => (
            <Column
              key={status.id}
              status={status.id}
              issues={groups[status.id]}
              projectKey={projectKey}
              selectedIds={selectedIds}
              onSelect={onSelect}
              activeId={activeId}
              pinnedIds={pinnedIds}
              onRegister={register}
              onCross={cross}
            />
          ))}
        </div>
      </div>
      {conflict ? (
        <ConflictPrompt
          actorName={conflict.actorName}
          pending={overwritePending}
          onReload={() => {
            setConflict(null);
            wantsRefreshRef.current = true;
            maybeRefresh();
          }}
          onOverwrite={() => void keepMove()}
        />
      ) : null}
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

function Column({
  status,
  issues,
  projectKey,
  selectedIds,
  onSelect,
  activeId,
  pinnedIds,
  onRegister,
  onCross,
}: {
  status: Status;
  issues: IssueDTO[];
  projectKey: string;
  selectedIds: string[];
  onSelect?: (id: string, mods: { shift: boolean; meta: boolean }) => void;
  activeId: string | null;
  pinnedIds: string[];
  onRegister: (status: Status, move: ((index: number) => void) | null) => void;
  onCross: (status: Status, direction: -1 | 1, index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);

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

  function measure(id: string, node: HTMLDivElement | null) {
    if (!node) return;
    const height = node.offsetHeight;
    if (height <= 0) return;
    setHeights((current) => {
      const previous = current[id];
      if (previous !== undefined && Math.abs(previous - height) < 1) return current;
      return { ...current, [id]: height };
    });
  }

  const pinIndexes: number[] = [];
  for (const id of activeId ? [...pinnedIds, activeId] : pinnedIds) {
    const index = issues.findIndex((issue) => issue.id === id);
    if (index >= 0) pinIndexes.push(index);
  }
  if (keyboardIndex !== null) pinIndexes.push(keyboardIndex);
  const layout = columnWindow({
    count: issues.length,
    scrollTop,
    viewport,
    heights: issues.map((issue) => heights[issue.id]),
    pinIndexes,
  });
  const focusAt = useWindowFocus(scrollerRef, layout.offsets);
  const moveToRef = useRef<(index: number) => void>(() => undefined);
  moveToRef.current = (index: number) => {
    setKeyboardIndex(index);
    focusAt(index);
  };

  useEffect(() => {
    onRegister(status, (index) => moveToRef.current(index));
    return () => onRegister(status, null);
  }, [onRegister, status]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const action = windowKeyAction(event.nativeEvent, issues.length);
    if (!action) return;
    event.preventDefault();
    if (action.type === "move") moveToRef.current(action.index);
    else onCross(status, action.direction, action.index);
  }

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={labelId}
      data-testid={`column-${status}`}
      data-drop-target={isOver ? "true" : "false"}
      className={cn(
        "flex h-full w-[78vw] max-w-[320px] shrink-0 flex-col rounded-xl bg-white/[0.025] sm:w-[300px] xl:w-auto xl:min-w-[240px] xl:flex-1",
        isOver && "bg-accent/15 ring-2 ring-inset ring-accent",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusIcon status={status} />
        <h2 id={labelId} className="text-[13px] font-medium">
          {statusLabel(status)}
        </h2>
        <span className="text-[12px] tabular-nums text-ink-faint">{issues.length}</span>
      </header>
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setKeyboardIndex(null);
        }}
        data-testid={`column-scroll-${status}`}
        data-column-scroll="true"
        data-virtualized={layout.virtualized ? "true" : "false"}
        data-rendered-count={layout.indexes.length}
        data-window-end={layout.end}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        style={{ overflowAnchor: "none" }}
      >
        {isOver ? <div data-testid={`drop-slot-${status}`} className="h-1.5 shrink-0 rounded-full bg-accent" /> : null}
        {issues.length === 0 ? (
          <p className={cn("px-2 py-8 text-center text-[12px]", isOver ? "text-accent-hover" : "text-ink-faint")}>
            {isOver ? "Drop here" : "No issues"}
          </p>
        ) : (
          <div role="list" aria-label={`${statusLabel(status)} issues, ${issues.length} total`} className="relative w-full shrink-0" style={{ height: layout.total }}>
            {layout.indexes.map((index) => {
              const issue = issues[index];
              if (!issue) return null;
              return (
                <div key={issue.id} ref={(node) => measure(issue.id, node)} className="absolute inset-x-0" style={{ top: layout.offsets[index] }}>
                  <IssueCard
                    issue={issue}
                    projectKey={projectKey}
                    selected={selectedIds.includes(issue.id)}
                    onSelect={onSelect}
                    position={{ index, count: issues.length }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
