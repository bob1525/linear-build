"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCommentAction, updateIssueAction } from "@/lib/actions/issues";
import { ConflictPrompt } from "@/components/conflict-prompt";
import { describeActivity } from "@/lib/activity";
import { PRIORITIES, STATUSES, priorityLabel, statusLabel, type Priority, type Status } from "@/lib/constants";
import { isOverdue, toDateInputValue } from "@/lib/format";
import type { ActionResult, ActivityDTO, CommentDTO, IssueCandidate, IssueDTO, IssueRelationGroups, LabelDTO, ProjectSummary, UserDTO } from "@/lib/types";
import { IssueRelations } from "@/components/issue-relations";
import { cn } from "@/lib/cn";
import { Avatar, LabelPill } from "@/components/avatar";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Menu, MenuOption } from "@/components/menu";
import { RelativeTime } from "@/components/relative-time";
import { useIsDesktop } from "@/components/use-media";
import { Button, ErrorNote, TextArea } from "@/components/ui";

export function IssueDetail({
  project,
  issue,
  comments,
  activities,
  members,
  labels,
  relations,
  candidates,
  currentUser,
}: {
  project: ProjectSummary;
  issue: IssueDTO;
  comments: CommentDTO[];
  activities: ActivityDTO[];
  members: UserDTO[];
  labels: LabelDTO[];
  relations: IssueRelationGroups;
  candidates: IssueCandidate[];
  currentUser: UserDTO;
}) {
  const desktop = useIsDesktop();
  const router = useRouter();
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(issue.updatedAt);
  const [conflict, setConflict] = useState<{ patch: IssuePatch; actorName: string | null } | null>(null);
  const [overwritePending, setOverwritePending] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [extraActivities, setExtraActivities] = useState<ActivityDTO[]>([]);

  useEffect(() => {
    setBaseUpdatedAt(issue.updatedAt);
  }, [issue.id, issue.updatedAt]);

  async function commit(patch: IssuePatch, overwrite = false) {
    const result = await updateIssueAction({ ...patch, baseUpdatedAt, overwrite });
    if (result.ok) setBaseUpdatedAt(result.data.updatedAt);
    else if (result.conflict && !overwrite) {
      setConflictError(null);
      setConflict({ patch, actorName: result.conflict.actorName });
    }
    return result;
  }

  async function overwriteConflict() {
    if (!conflict) return;
    setOverwritePending(true);
    const result = await commit(conflict.patch, true);
    setOverwritePending(false);
    if (!result.ok) {
      setConflictError(result.error);
      return;
    }
    setConflict(null);
    router.refresh();
  }

  function reloadConflict() {
    setConflict(null);
    router.refresh();
  }
  useEffect(() => {
    setExtraActivities([]);
  }, [issue.id]);
  const visibleActivities = [
    ...extraActivities.filter((item) => !activities.some((activity) => activityFingerprint(activity) === activityFingerprint(item))),
    ...activities,
  ];
  const properties = (
    <Properties
      issue={issue}
      members={members}
      labels={labels}
      currentUser={currentUser}
      onActivity={(activity) => setExtraActivities((current) => [activity, ...current])}
      commit={commit}
    />
  );
  const activity = <ActivityList activities={visibleActivities} />;

  return (
    <>
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <article className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12px] text-ink-muted">
            <Link href={`/p/${project.key}`} className="hover:text-ink">
              {project.name}
            </Link>
            <span className="text-ink-faint">/</span>
            <span className="font-mono text-ink-faint">{issue.key}</span>
          </p>
          <TitleEditor issue={issue} commit={commit} />
          {!desktop ? <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3">{properties}</div> : null}
          <DescriptionEditor issue={issue} commit={commit} />
          <IssueRelations
            projectKey={project.key}
            issueId={issue.id}
            issueKey={issue.key}
            relations={relations}
            candidates={candidates}
            currentUser={currentUser}
            onActivity={(activity) => setExtraActivities((current) => [activity, ...current])}
          />
          <CommentSection
            issueId={issue.id}
            comments={comments}
            currentUser={currentUser}
            onCommented={(activity) => setExtraActivities((current) => [activity, ...current])}
            onVersion={setBaseUpdatedAt}
          />
          {!desktop ? <div className="mt-8">{activity}</div> : null}
        </article>
        {desktop ? (
          <aside data-testid="properties" className="w-full shrink-0 lg:w-[300px]">
            <div className="space-y-8 lg:sticky lg:top-6">
              {properties}
              {activity}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
    {conflict ? (
      <ConflictPrompt
        actorName={conflict.actorName}
        pending={overwritePending}
        error={conflictError}
        onReload={reloadConflict}
        onOverwrite={() => void overwriteConflict()}
      />
    ) : null}
    </>
  );
}

type IssuePatch = {
  issueId: string;
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labelIds?: string[];
};

type Commit = (patch: IssuePatch, overwrite?: boolean) => Promise<ActionResult<{ id: string; updatedAt: string }>>;

function TitleEditor({ issue, commit }: { issue: IssueDTO; commit: Commit }) {
  const router = useRouter();
  const field = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(issue.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => setTitle(issue.title), [issue.title]);

  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${node.scrollHeight}px`;
  }, [title]);

  async function save() {
    const next = title.trim();
    if (!next || next === issue.title) {
      setTitle(issue.title);
      return;
    }
    setPending(true);
    const result = await commit({ issueId: issue.id, title: next });
    setPending(false);
    if (!result.ok) {
      if (!result.conflict) setError(result.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <label className="sr-only" htmlFor="issue-title">
        Title
      </label>
      <textarea
        ref={field}
        id="issue-title"
        value={title}
        rows={1}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setTitle(issue.title);
            event.currentTarget.blur();
          }
        }}
        maxLength={200}
        className="w-full resize-none overflow-hidden bg-transparent text-[22px] font-semibold leading-tight tracking-tight outline-none sm:text-[26px]"
      />
      {error ? <div className="mt-2"><ErrorNote>{error}</ErrorNote></div> : null}
      {pending ? <p className="mt-1 text-[11px] text-ink-faint">Saving…</p> : null}
    </div>
  );
}

function DescriptionEditor({ issue, commit }: { issue: IssueDTO; commit: Commit }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.description);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => setDraft(issue.description), [issue.description]);

  async function save() {
    if (draft === issue.description) {
      setEditing(false);
      return;
    }
    setPending(true);
    const result = await commit({ issueId: issue.id, description: draft });
    setPending(false);
    if (!result.ok) {
      if (!result.conflict) setError(result.error);
      return;
    }
    setError(null);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Description</h2>
        {issue.description && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="text-[12px] text-ink-muted hover:text-ink">
            Edit
          </button>
        ) : null}
      </div>
      {error ? <div className="mb-2"><ErrorNote>{error}</ErrorNote></div> : null}
      {editing || !issue.description ? (
        <div>
          <TextArea
            aria-label="Description"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add context, steps, or a decision. Markdown works here."
            className="min-h-36"
            maxLength={20000}
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-ink-faint">Markdown supported</p>
            <div className="flex gap-2">
              {issue.description ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(issue.description);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
              <Button size="sm" onClick={save} disabled={pending || draft === issue.description}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Markdown source={issue.description} />
      )}
    </section>
  );
}

function CommentSection({
  issueId,
  comments,
  currentUser,
  onCommented,
  onVersion,
}: {
  issueId: string;
  comments: CommentDTO[];
  currentUser: UserDTO;
  onCommented: (activity: ActivityDTO) => void;
  onVersion: (updatedAt: string) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pendingComments, setPendingComments] = useState<CommentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shownComments = [
    ...comments,
    ...pendingComments.filter((comment) => !comments.some((existing) => existing.id === comment.id)),
  ];

  useEffect(() => {
    setPendingComments((current) => current.filter((comment) => !comments.some((existing) => existing.id === comment.id)));
  }, [comments]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const draft = body;
    setPending(true);
    setError(null);
    const result = await createCommentAction({ issueId, body: draft });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onVersion(result.data.updatedAt);
    const createdAt = new Date().toISOString();
    setPendingComments((current) => [
      ...current,
      { id: result.data.id, body: draft, createdAt, author: currentUser },
    ]);
    onCommented({
      id: `comment-${result.data.id}`,
      type: "commented",
      payload: "{}",
      createdAt,
      actor: currentUser,
    });
    setBody("");
    router.refresh();
  }

  return (
    <section className="mt-10">
      <h2 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Comments</h2>
      {shownComments.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-muted">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="mt-3 space-y-3" data-testid="comments">
          {shownComments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.author.name} size={24} />
              <div className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{comment.author.name}</span>
                  <RelativeTime iso={comment.createdAt} className="text-[11px] text-ink-faint" />
                </div>
                <div className="mt-1">
                  <Markdown source={comment.body} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-4" onSubmit={submit}>
        {error ? <div className="mb-2"><ErrorNote>{error}</ErrorNote></div> : null}
        <label className="block">
          <span className="sr-only">Comment</span>
          <TextArea
            aria-label="Comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a comment… Markdown is supported. ⌘ Enter to post."
            maxLength={10000}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={pending || body.trim().length === 0}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function activityFingerprint(activity: ActivityDTO) {
  return `${activity.type}|${activity.actor.id}|${describeActivity(activity.type, activity.payload)}`;
}

function Properties({
  issue,
  members,
  labels,
  currentUser,
  onActivity,
  commit,
}: {
  issue: IssueDTO;
  members: UserDTO[];
  labels: LabelDTO[];
  currentUser: UserDTO;
  onActivity: (activity: ActivityDTO) => void;
  commit: Commit;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(issue.status);

  useEffect(() => setStatus(issue.status), [issue.status]);

  async function save(patch: {
    issueId: string;
    title?: string;
    description?: string;
    status?: Status;
    priority?: Priority;
    assigneeId?: string | null;
    dueDate?: string | null;
    labelIds?: string[];
  }) {
    const previousStatus = status;
    if (patch.status && patch.status !== status) setStatus(patch.status);
    setPending(true);
    setError(null);
    const result = await commit(patch);
    setPending(false);
    if (!result.ok) {
      if (patch.status) setStatus(previousStatus);
      if (!result.conflict) setError(result.error);
      return;
    }
    if (patch.status && patch.status !== previousStatus) {
      onActivity({
        id: `status-${issue.id}-${patch.status}`,
        type: "status_changed",
        payload: JSON.stringify({ from: previousStatus, to: patch.status }),
        createdAt: new Date().toISOString(),
        actor: currentUser,
      });
    }
    router.refresh();
  }

  function toggleLabel(id: string) {
    const current = issue.labels.map((label) => label.id);
    const labelIds = current.includes(id) ? current.filter((labelId) => labelId !== id) : [...current, id];
    void save({ issueId: issue.id, labelIds });
  }

  return (
    <section aria-label="Issue properties" className={cn(pending && "opacity-70")}>
      <h2 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Properties</h2>
      {pending ? (
        <p data-testid="properties-saving" className="mt-1 text-[11px] text-ink-faint">
          Saving…
        </p>
      ) : null}
      {error ? <div className="mt-2"><ErrorNote>{error}</ErrorNote></div> : null}
      <dl className="mt-3 space-y-3">
        <Property label="Status">
          <Menu
            label="Status"
            testId="status-select"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 hover:bg-white/5">
                <StatusIcon status={status} />
                {statusLabel(status)}
              </span>
            }
          >
            {STATUSES.map((item) => (
              <MenuOption key={item.id} selected={item.id === status} onSelect={() => void save({ issueId: issue.id, status: item.id })}>
                <span className="inline-flex items-center gap-2">
                  <StatusIcon status={item.id} />
                  {item.label}
                </span>
              </MenuOption>
            ))}
          </Menu>
        </Property>
        <Property label="Priority">
          <Menu
            label="Priority"
            trigger={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 hover:bg-white/5">
                <PriorityIcon priority={issue.priority} />
                {priorityLabel(issue.priority)}
              </span>
            }
          >
            {PRIORITIES.map((priority) => (
              <MenuOption
                key={priority.id}
                selected={priority.id === issue.priority}
                onSelect={() => save({ issueId: issue.id, priority: priority.id })}
              >
                <span className="inline-flex items-center gap-2">
                  <PriorityIcon priority={priority.id} />
                  {priority.label}
                </span>
              </MenuOption>
            ))}
          </Menu>
        </Property>
        <Property label="Assignee">
          <Menu
            label="Assignee"
            trigger={<span className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 hover:bg-white/5">{issue.assignee?.name ?? "Unassigned"}</span>}
          >
            <MenuOption selected={!issue.assignee} onSelect={() => save({ issueId: issue.id, assigneeId: null })}>
              Unassigned
            </MenuOption>
            {members.map((member) => (
              <MenuOption key={member.id} selected={issue.assignee?.id === member.id} onSelect={() => save({ issueId: issue.id, assigneeId: member.id })}>
                {member.name}
              </MenuOption>
            ))}
          </Menu>
        </Property>
        <Property label="Due date">
          <label className={cn("inline-flex h-7 items-center rounded-md px-1.5 text-[13px] hover:bg-white/5", isOverdue(issue.dueDate, issue.status) && "text-red-300")}>
            <span className="sr-only">Due date</span>
            <input
              type="date"
              value={toDateInputValue(issue.dueDate)}
              onChange={(event) => save({ issueId: issue.id, dueDate: event.target.value || null })}
              className="bg-transparent text-inherit outline-none"
            />
          </label>
        </Property>
        <div>
          <dt className="mb-1.5 text-[12px] text-ink-faint">Labels</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {issue.labels.map((label) => (
              <button key={label.id} type="button" onClick={() => toggleLabel(label.id)} className="rounded-full hover:bg-white/5" aria-label={`Remove ${label.name}`}>
                <LabelPill name={label.name} color={label.color} />
              </button>
            ))}
            <Menu label="Add label" trigger={<span className="inline-flex h-6 items-center rounded-md px-1.5 text-[12px] text-ink-muted hover:bg-white/5">+ Label</span>}>
              {labels.map((label) => (
                <MenuOption key={label.id} selected={issue.labels.some((item) => item.id === label.id)} closeOnSelect={false} onSelect={() => toggleLabel(label.id)}>
                  <LabelPill name={label.name} color={label.color} />
                </MenuOption>
              ))}
            </Menu>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-[11px] text-ink-faint">
        Opened by {issue.creator.name} · <RelativeTime iso={issue.createdAt} />
      </p>
    </section>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-[13px]">{children}</dd>
    </div>
  );
}

function ActivityList({ activities }: { activities: ActivityDTO[] }) {
  return (
    <section>
      <h2 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Activity</h2>
      {activities.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-muted">No activity yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="flex gap-2">
              <Avatar name={activity.actor.name} size={18} />
              <div className="min-w-0">
                <p className="text-[12px] leading-5 text-ink-muted">
                  <span className="font-medium text-ink">{activity.actor.name}</span> {describeActivity(activity.type, activity.payload)}
                </p>
                <RelativeTime iso={activity.createdAt} className="text-[11px] text-ink-faint" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
