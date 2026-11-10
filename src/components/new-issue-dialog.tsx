"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createIssueAction } from "@/lib/actions/issues";
import { PRIORITIES, STATUSES, priorityLabel, statusLabel, type Priority, type Status } from "@/lib/constants";
import type { ProjectSummary } from "@/lib/types";
import { LabelPill } from "@/components/avatar";
import { Dialog } from "@/components/dialog";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { Menu, MenuOption } from "@/components/menu";
import { useShell } from "@/components/shell-context";
import { Button, ErrorNote, TextArea, TextField } from "@/components/ui";

export function NewIssueDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: ProjectSummary | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const shell = useShell();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [priority, setPriority] = useState<Priority>("none");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("none");
    setAssigneeId(null);
    setDueDate("");
    setLabelIds([]);
    setError(null);
  }, [open, project?.id]);

  if (!open || !project) return null;
  const currentProject = project;

  const assignee = currentProject.members.find((member) => member.id === assigneeId) ?? null;

  function toggleLabel(id: string) {
    setLabelIds((current) => (current.includes(id) ? current.filter((labelId) => labelId !== id) : [...current, id]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await createIssueAction({
      projectKey: currentProject.key,
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate: dueDate || null,
      labelIds,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    shell.notify(`Created ${result.data.key}`, `/p/${currentProject.key}/issues/${result.data.number}`);
    router.refresh();
  }

  return (
    <Dialog title="New issue" description={`${currentProject.name} · ${currentProject.key}`} onClose={onClose} wide>
      <form
        onSubmit={(event) => void onSubmit(event)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        className="space-y-3 p-4"
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <label className="block">
          <span className="sr-only">Title</span>
          <TextField
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Issue title"
            required
            maxLength={200}
            className="h-11 border-transparent bg-transparent px-0 text-[18px] font-medium placeholder:text-ink-faint focus:border-transparent"
          />
        </label>
        <label className="block">
          <span className="sr-only">Description</span>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add a description… Markdown is supported."
            className="min-h-36 border-transparent bg-transparent px-0 focus:border-transparent"
            maxLength={20000}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Menu
            label="Status"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 text-[12px]">
                <StatusIcon status={status} />
                {statusLabel(status)}
              </span>
            }
          >
            {STATUSES.map((item) => (
              <MenuOption key={item.id} selected={item.id === status} onSelect={() => setStatus(item.id)}>
                <span className="inline-flex items-center gap-2">
                  <StatusIcon status={item.id} />
                  {item.label}
                </span>
              </MenuOption>
            ))}
          </Menu>
          <Menu
            label="Priority"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 text-[12px]">
                <PriorityIcon priority={priority} />
                {priorityLabel(priority)}
              </span>
            }
          >
            {PRIORITIES.map((item) => (
              <MenuOption key={item.id} selected={item.id === priority} onSelect={() => setPriority(item.id)}>
                <span className="inline-flex items-center gap-2">
                  <PriorityIcon priority={item.id} />
                  {item.label}
                </span>
              </MenuOption>
            ))}
          </Menu>
          <Menu
            label="Assignee"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 text-[12px]">
                {assignee ? assignee.name : "Unassigned"}
              </span>
            }
          >
            <MenuOption selected={!assigneeId} onSelect={() => setAssigneeId(null)}>
              Unassigned
            </MenuOption>
            {currentProject.members.map((member) => (
              <MenuOption key={member.id} selected={member.id === assigneeId} onSelect={() => setAssigneeId(member.id)}>
                {member.name}
              </MenuOption>
            ))}
          </Menu>
          <Menu
            label="Labels"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 text-[12px]">
                {labelIds.length > 0 ? `${labelIds.length} labels` : "Labels"}
              </span>
            }
          >
            {currentProject.labels.map((label) => (
              <MenuOption key={label.id} selected={labelIds.includes(label.id)} closeOnSelect={false} onSelect={() => toggleLabel(label.id)}>
                <LabelPill name={label.name} color={label.color} />
              </MenuOption>
            ))}
          </Menu>
          <label className="inline-flex h-7 items-center gap-2 rounded-md border border-line bg-white/[0.03] px-2 text-[12px] text-ink-muted">
            <span>Due</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="Due date"
              className="bg-transparent text-ink outline-none"
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-ink-faint sm:inline">⌘ Enter</span>
            <Button type="submit" disabled={pending || title.trim().length === 0}>
              {pending ? "Creating…" : "Create issue"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
