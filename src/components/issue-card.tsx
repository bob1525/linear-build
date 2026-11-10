"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { isOverdue, formatDueDate } from "@/lib/format";
import { priorityLabel } from "@/lib/constants";
import { Avatar, LabelPill } from "@/components/avatar";
import { BlockingMarks } from "@/components/blocking-marks";
import { CalendarIcon, GripIcon, PriorityIcon } from "@/components/icons";

export function IssueCard({
  issue,
  projectKey,
  overlay = false,
  selected = false,
  onSelect,
}: {
  issue: IssueDTO;
  projectKey: string;
  overlay?: boolean;
  selected?: boolean;
  onSelect?: (id: string, mods: { shift: boolean; meta: boolean }) => void;
}) {
  if (overlay) return <CardFace issue={issue} projectKey={projectKey} overlay />;
  return <DraggableCard issue={issue} projectKey={projectKey} selected={selected} onSelect={onSelect} />;
}

function DraggableCard({
  issue,
  projectKey,
  selected,
  onSelect,
}: {
  issue: IssueDTO;
  projectKey: string;
  selected: boolean;
  onSelect?: (id: string, mods: { shift: boolean; meta: boolean }) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.id });
  return (
    <div ref={setNodeRef}>
      <CardFace
        issue={issue}
        projectKey={projectKey}
        selected={selected}
        onSelect={onSelect}
        placeholder={isDragging}
        dragHandle={{ attributes, listeners }}
      />
    </div>
  );
}

function CardFace({
  issue,
  projectKey,
  overlay = false,
  placeholder = false,
  selected = false,
  onSelect,
  dragHandle,
}: {
  issue: IssueDTO;
  projectKey: string;
  overlay?: boolean;
  placeholder?: boolean;
  selected?: boolean;
  onSelect?: (id: string, mods: { shift: boolean; meta: boolean }) => void;
  dragHandle?: {
    attributes: ReturnType<typeof useDraggable>["attributes"];
    listeners: ReturnType<typeof useDraggable>["listeners"];
  };
}) {
  const overdue = isOverdue(issue.dueDate, issue.status);

  return (
    <article
      data-testid={`card-${issue.key}`}
      data-blocked={issue.blockedByCount > 0 ? "true" : "false"}
      data-blocks={issue.blocksCount > 0 ? "true" : "false"}
      data-placeholder={placeholder ? "true" : undefined}
      data-selected={selected ? "true" : "false"}
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
        "rounded-lg border border-line bg-panel shadow-card",
        overlay && "rotate-[1.5deg] shadow-pop",
        placeholder && "border-dashed border-accent/70 bg-accent/5 opacity-50",
        selected && "border-accent/70 ring-1 ring-accent/70",
      )}
    >
      <div className="flex items-start gap-1 p-2">
        {onSelect ? <SelectBox issue={issue} selected={selected} onSelect={onSelect} /> : null}
        {dragHandle ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab rounded p-0.5 text-ink-faint hover:bg-white/5 hover:text-ink-muted active:cursor-grabbing"
            aria-label={`Drag ${issue.key}`}
            data-testid={`drag-${issue.key}`}
            {...dragHandle.listeners}
            {...dragHandle.attributes}
          >
            <GripIcon />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <PriorityIcon priority={issue.priority} />
            <span className="font-mono text-[11px] text-ink-faint" title={priorityLabel(issue.priority)}>
              {issue.key}
            </span>
            <BlockingMarks issue={issue} />
          </div>
          <Link
            href={`/p/${projectKey}/issues/${issue.number}`}
            className="mt-1 block text-[13px] font-medium leading-5 text-ink hover:text-white"
          >
            {issue.title}
          </Link>
          {issue.labels.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <LabelPill key={label.id} name={label.name} color={label.color} />
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            {issue.dueDate ? (
              <span className={cn("inline-flex items-center gap-1 text-[11px]", overdue ? "text-red-300" : "text-ink-faint")}>
                <CalendarIcon />
                {formatDueDate(issue.dueDate)}
              </span>
            ) : (
              <span />
            )}
            {issue.assignee ? <Avatar name={issue.assignee.name} /> : <span className="h-5 w-5 rounded-full border border-dashed border-line" title="Unassigned" />}
          </div>
        </div>
      </div>
    </article>
  );
}

function SelectBox({
  issue,
  selected,
  onSelect,
}: {
  issue: IssueDTO;
  selected: boolean;
  onSelect: (id: string, mods: { shift: boolean; meta: boolean }) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${issue.key}`}
      data-testid={`select-${issue.key}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(issue.id, { shift: event.shiftKey, meta: event.metaKey || event.ctrlKey });
      }}
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded border border-line",
        selected ? "border-accent bg-accent" : "bg-black/20 hover:border-ink-faint",
      )}
    />
  );
}
