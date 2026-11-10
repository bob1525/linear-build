"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { conflictCopy, shouldRejectStaleWrite } from "@/lib/concurrency";
import { prisma } from "@/lib/db";
import { publicUserSelect } from "@/lib/dto";
import { formatIssueKey, parseDueDateInput } from "@/lib/format";
import { conflict, fail, ok, type ActionResult } from "@/lib/types";
import { commentSchema, createIssueSchema, firstIssue, updateIssueSchema } from "@/lib/validators";

function revalidateIssuePaths(projectKey: string, number?: number) {
  revalidatePath(`/p/${projectKey}`);
  revalidatePath(`/p/${projectKey}/list`);
  if (number) revalidatePath(`/p/${projectKey}/issues/${number}`);
}

async function memberProject(userId: string, projectKey: string) {
  const project = await prisma.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    include: { members: true, labels: true },
  });
  if (!project || !project.members.some((member) => member.userId === userId)) return null;
  return project;
}

export async function createIssueAction(input: unknown): Promise<ActionResult<{ id: string; key: string; number: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");

  const parsed = createIssueSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const project = await memberProject(user.id, parsed.data.projectKey);
  if (!project) return fail("Project not found");

  const assigneeId = parsed.data.assigneeId || null;
  if (assigneeId && !project.members.some((member) => member.userId === assigneeId)) {
    return fail("Assignee is not a member of this project");
  }

  const labelIds = parsed.data.labelIds ?? [];
  if (labelIds.some((labelId) => !project.labels.some((label) => label.id === labelId))) {
    return fail("One of those labels is not in this project");
  }

  const dueDate = parsed.data.dueDate ? parseDueDateInput(parsed.data.dueDate) : null;
  if (parsed.data.dueDate && !dueDate) return fail("Due date is invalid");

  try {
    const issue = await prisma.$transaction(async (tx) => {
      const latest = await tx.issue.findFirst({
        where: { projectId: project.id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      return tx.issue.create({
        data: {
          projectId: project.id,
          number: (latest?.number ?? 0) + 1,
          title: parsed.data.title,
          description: parsed.data.description,
          status: parsed.data.status,
          priority: parsed.data.priority,
          assigneeId,
          creatorId: user.id,
          dueDate,
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
          activities: {
            create: { actorId: user.id, type: "created", payload: "{}" },
          },
        },
      });
    });

    revalidateIssuePaths(project.key, issue.number);
    return ok({ id: issue.id, key: formatIssueKey(project.key, issue.number), number: issue.number });
  } catch (error) {
    console.error(error);
    return fail("Could not create the issue. Please try again.");
  }
}

export async function updateIssueAction(input: unknown): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");

  const parsed = updateIssueSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const existing = await prisma.issue.findUnique({
    where: { id: parsed.data.issueId },
    include: {
      assignee: { select: publicUserSelect },
      labels: { include: { label: true } },
      project: { select: { id: true, key: true } },
    },
  });
  if (!existing) return fail("Issue not found");

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: existing.projectId, userId: user.id } },
  });
  if (!membership) return fail("Issue not found");

  const data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    dueDate?: Date | null;
  } = {};
  const activities: { type: string; payload: string }[] = [];

  if (parsed.data.title !== undefined && parsed.data.title !== existing.title) {
    data.title = parsed.data.title;
    activities.push({
      type: "title_changed",
      payload: JSON.stringify({ from: existing.title, to: parsed.data.title }),
    });
  }

  if (parsed.data.description !== undefined && parsed.data.description !== existing.description) {
    data.description = parsed.data.description;
    activities.push({ type: "description_changed", payload: "{}" });
  }

  if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
    data.status = parsed.data.status;
    activities.push({
      type: "status_changed",
      payload: JSON.stringify({ from: existing.status, to: parsed.data.status }),
    });
  }

  if (parsed.data.priority !== undefined && parsed.data.priority !== existing.priority) {
    data.priority = parsed.data.priority;
    activities.push({
      type: "priority_changed",
      payload: JSON.stringify({ from: existing.priority, to: parsed.data.priority }),
    });
  }

  if (parsed.data.assigneeId !== undefined && (parsed.data.assigneeId || null) !== existing.assigneeId) {
    const nextId = parsed.data.assigneeId || null;
    let toName: string | null = null;
    if (nextId) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: existing.projectId, userId: nextId } },
        include: { user: { select: publicUserSelect } },
      });
      if (!member) return fail("Assignee is not a member of this project");
      toName = member.user.name;
    }
    data.assigneeId = nextId;
    activities.push({
      type: "assignee_changed",
      payload: JSON.stringify({
        fromId: existing.assigneeId,
        fromName: existing.assignee?.name ?? null,
        toId: nextId,
        toName,
      }),
    });
  }

  if (parsed.data.dueDate !== undefined) {
    const next = parsed.data.dueDate ? parseDueDateInput(parsed.data.dueDate) : null;
    if (parsed.data.dueDate && !next) return fail("Due date is invalid");
    const previousDay = existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : null;
    const nextDay = next ? next.toISOString().slice(0, 10) : null;
    if (previousDay !== nextDay) {
      data.dueDate = next;
      activities.push({
        type: "due_date_changed",
        payload: JSON.stringify({
          from: existing.dueDate ? existing.dueDate.toISOString() : null,
          to: next ? next.toISOString() : null,
        }),
      });
    }
  }

  let replaceLabels = false;
  if (parsed.data.labelIds) {
    const currentIds = new Set(existing.labels.map((row) => row.labelId));
    const nextIds = [...new Set(parsed.data.labelIds)];
    const sameSize = currentIds.size === nextIds.length && nextIds.every((id) => currentIds.has(id));
    if (!sameSize) {
      const projectLabels = await prisma.label.findMany({ where: { projectId: existing.projectId } });
      if (nextIds.some((id) => !projectLabels.some((label) => label.id === id))) {
        return fail("One of those labels is not in this project");
      }
      const nextSet = new Set(nextIds);
      const added = projectLabels.filter((label) => nextSet.has(label.id) && !currentIds.has(label.id)).map((label) => label.name);
      const removed = existing.labels.filter((row) => !nextSet.has(row.labelId)).map((row) => row.label.name);
      replaceLabels = true;
      activities.push({
        type: "labels_changed",
        payload: JSON.stringify({ added, removed }),
      });
    }
  }

  if (Object.keys(data).length === 0 && !replaceLabels) {
    return ok({ id: existing.id, updatedAt: existing.updatedAt.toISOString() });
  }

  if (
    shouldRejectStaleWrite({
      baseUpdatedAt: parsed.data.baseUpdatedAt,
      overwrite: parsed.data.overwrite,
      currentUpdatedAt: existing.updatedAt,
    })
  ) {
    const latest = await prisma.activity.findFirst({
      where: { issueId: existing.id },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    });
    const actorName = latest?.actor.name ?? null;
    return conflict(conflictCopy(actorName), {
      updatedAt: existing.updatedAt.toISOString(),
      actorName,
    });
  }

  try {
    const updatedAt = await prisma.$transaction(async (tx) => {
      const saved = await tx.issue.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() },
        select: { updatedAt: true },
      });
      if (replaceLabels && parsed.data.labelIds) {
        const nextIds = [...new Set(parsed.data.labelIds)];
        await tx.issueLabel.deleteMany({ where: { issueId: existing.id } });
        if (nextIds.length > 0) {
          await tx.issueLabel.createMany({
            data: nextIds.map((labelId) => ({ issueId: existing.id, labelId })),
          });
        }
      }
      if (activities.length > 0) {
        await tx.activity.createMany({
          data: activities.map((activity) => ({
            issueId: existing.id,
            actorId: user.id,
            type: activity.type,
            payload: activity.payload,
          })),
        });
      }
      return saved.updatedAt;
    });
    revalidateIssuePaths(existing.project.key, existing.number);
    return ok({ id: existing.id, updatedAt: updatedAt.toISOString() });
  } catch (error) {
    console.error(error);
    return fail("Could not update the issue. Please try again.");
  }
}

export async function createCommentAction(input: unknown): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const issue = await prisma.issue.findUnique({
    where: { id: parsed.data.issueId },
    include: { project: { select: { id: true, key: true } } },
  });
  if (!issue) return fail("Issue not found");

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: issue.projectId, userId: user.id } },
  });
  if (!membership) return fail("Issue not found");

  try {
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { issueId: issue.id, authorId: user.id, body: parsed.data.body },
      });
      await tx.activity.create({
        data: { issueId: issue.id, actorId: user.id, type: "commented", payload: "{}" },
      });
      const saved = await tx.issue.update({
        where: { id: issue.id },
        data: { updatedAt: new Date() },
        select: { updatedAt: true },
      });
      return { id: created.id, updatedAt: saved.updatedAt.toISOString() };
    });
    revalidateIssuePaths(issue.project.key, issue.number);
    return ok(comment);
  } catch (error) {
    console.error(error);
    return fail("Could not post the comment. Please try again.");
  }
}
