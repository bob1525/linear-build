"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { planBatch, type BatchIssue, type BatchOp, type BatchResult } from "@/lib/batch";
import { prisma } from "@/lib/db";
import { formatIssueKey } from "@/lib/format";
import { fail, ok, type ActionResult } from "@/lib/types";
import { batchSchema, firstIssue } from "@/lib/validators";

type LoadedIssue = BatchIssue & { number: number; assigneeName: string | null };

export async function batchIssuesAction(input: unknown): Promise<ActionResult<BatchResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const project = await prisma.project.findUnique({
    where: { key: parsed.data.projectKey.toUpperCase() },
    include: {
      members: { select: { userId: true, user: { select: { name: true } } } },
      labels: true,
    },
  });
  if (!project || !project.members.some((member) => member.userId === user.id)) return fail("Project not found");

  const ids = [...new Set(parsed.data.issueIds)];
  const rows = await prisma.issue.findMany({
    where: { id: { in: ids }, projectId: project.id },
    include: { labels: { select: { labelId: true } }, assignee: { select: { name: true } } },
  });
  const loaded = new Map<string, LoadedIssue>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        key: formatIssueKey(project.key, row.number),
        number: row.number,
        status: row.status,
        assigneeId: row.assigneeId,
        assigneeName: row.assignee?.name ?? null,
        labelIds: row.labels.map((label) => label.labelId),
      },
    ]),
  );
  const plan = planBatch(
    [...loaded.values()],
    ids,
    parsed.data.op,
    {
      memberIds: project.members.map((member) => member.userId),
      labelIds: project.labels.map((label) => label.id),
    },
  );

  const succeeded: BatchResult["succeeded"] = [];
  const failed = [...plan.failed];
  for (const item of plan.succeeded) {
    const issue = loaded.get(item.id);
    if (!issue) {
      failed.push({ id: item.id, key: item.key, error: "Issue not found" });
      continue;
    }
    try {
      await commitOne(user.id, issue, parsed.data.op, project.labels, project.members);
      succeeded.push(item);
    } catch (error) {
      console.error(error);
      failed.push({ id: item.id, key: item.key, error: "Could not update the issue. Please try again." });
    }
  }

  revalidatePath(`/p/${project.key}`);
  revalidatePath(`/p/${project.key}/list`);
  for (const issue of loaded.values()) revalidatePath(`/p/${project.key}/issues/${issue.number}`);
  return ok({ succeeded, failed });
}

async function commitOne(
  actorId: string,
  issue: LoadedIssue,
  op: BatchOp,
  labels: { id: string; name: string }[],
  members: { userId: string; user: { name: string } }[],
) {
  if (op.type === "delete") {
    await prisma.issue.delete({ where: { id: issue.id } });
    return;
  }
  if (op.type === "status") {
    if (issue.status === op.status) return;
    await prisma.$transaction([
      prisma.issue.update({ where: { id: issue.id }, data: { status: op.status } }),
      prisma.activity.create({
        data: {
          issueId: issue.id,
          actorId,
          type: "status_changed",
          payload: JSON.stringify({ from: issue.status, to: op.status }),
        },
      }),
    ]);
    return;
  }
  if (op.type === "assignee") {
    const nextId = op.assigneeId;
    if ((issue.assigneeId ?? null) === nextId) return;
    const toName = nextId ? (members.find((member) => member.userId === nextId)?.user.name ?? null) : null;
    await prisma.$transaction([
      prisma.issue.update({ where: { id: issue.id }, data: { assigneeId: nextId } }),
      prisma.activity.create({
        data: {
          issueId: issue.id,
          actorId,
          type: "assignee_changed",
          payload: JSON.stringify({
            fromId: issue.assigneeId,
            fromName: issue.assigneeName,
            toId: nextId,
            toName,
          }),
        },
      }),
    ]);
    return;
  }
  const hasLabel = issue.labelIds.includes(op.labelId);
  if (op.type === "add_label" && hasLabel) return;
  if (op.type === "remove_label" && !hasLabel) return;
  const labelName = labels.find((label) => label.id === op.labelId)?.name ?? "Label";
  await prisma.$transaction(async (tx) => {
    await tx.issue.update({ where: { id: issue.id }, data: { updatedAt: new Date() } });
    if (op.type === "add_label") {
      await tx.issueLabel.create({ data: { issueId: issue.id, labelId: op.labelId } });
    } else {
      await tx.issueLabel.deleteMany({ where: { issueId: issue.id, labelId: op.labelId } });
    }
    await tx.activity.create({
      data: {
        issueId: issue.id,
        actorId,
        type: "labels_changed",
        payload: JSON.stringify({
          added: op.type === "add_label" ? [labelName] : [],
          removed: op.type === "remove_label" ? [labelName] : [],
        }),
      },
    });
  });
}
