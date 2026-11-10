"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { IssueDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { isOverdue, formatDueDate } from "@/lib/format";
import { priorityLabel } from "@/lib/constants";
import { Avatar, LabelPill } from "@/components/avatar";
import { CalendarIcon, GripIcon, PriorityIcon } from "@/components/icons";

export function IssueCard({
  issue,
  projectKey,
  overlay = false,
}: {
  issue: IssueDTO;
  projectKey: string;
  overlay?: boolean;
}) {
  if (overlay) return <CardFace issue={issue} projectKey={projectKey} overlay />;
  return <DraggableCard issue={issue} projectKey={projectKey} />;
}

function DraggableCard({ issue, projectKey }: { issue: IssueDTO; projectKey: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <CardFace issue={issue} projectKey={projectKey} dragHandle={{ attributes, listeners }} />
    </div>
  );
}

function CardFace({
  issue,
  projectKey,
  overlay = false,
  dragHandle,
}: {
  issue: IssueDTO;
  projectKey: string;
  overlay?: boolean;
  dragHandle?: {
    attributes: ReturnType<typeof useDraggable>["attributes"];
    listeners: ReturnType<typeof useDraggable>["listeners"];
  };
}) {
  const overdue = isOverdue(issue.dueDate, issue.status);

  return (
    <article
      data-testid={`card-${issue.key}`}
      className={cn("rounded-lg border border-line bg-panel shadow-card", overlay && "rotate-[1.5deg] shadow-pop")}
    >
      <div className="flex items-start gap-1 p-2">
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
