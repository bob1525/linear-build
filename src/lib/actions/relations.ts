"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatIssueKey } from "@/lib/format";
import {
  RELATION_ERRORS,
  addRelation,
  addSubIssue,
  parseIssueTarget,
  removeRelation,
  removeSubIssue,
  type PlannedEdge,
  type RelationKind,
} from "@/lib/relations";
import { fail, ok, type ActionResult } from "@/lib/types";
import { changeRelationSchema, firstIssue } from "@/lib/validators";

function revalidateIssue(projectKey: string, numbers: number[]) {
  revalidatePath(`/p/${projectKey}`);
  revalidatePath(`/p/${projectKey}/list`);
  for (const number of numbers) revalidatePath(`/p/${projectKey}/issues/${number}`);
}

function otherRole(kind: RelationKind): RelationKind {
  if (kind === "blocks") return "blocked_by";
  if (kind === "blocked_by") return "blocks";
  return "related";
}

export async function addIssueRelationAction(input: unknown): Promise<ActionResult<{ otherIssueId: string }>> {
  return changeIssueRelation(input, "add");
}

export async function removeIssueRelationAction(input: unknown): Promise<ActionResult<{ otherIssueId: string }>> {
  return changeIssueRelation(input, "remove");
}

async function changeIssueRelation(input: unknown, mode: "add" | "remove"): Promise<ActionResult<{ otherIssueId: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");

  const parsed = changeRelationSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const issue = await prisma.issue.findUnique({
    where: { id: parsed.data.issueId },
    include: { project: { select: { id: true, key: true, members: { select: { userId: true } } } } },
  });
  if (!issue || !issue.project.members.some((member) => member.userId === user.id)) return fail(RELATION_ERRORS.notFound);

  const number = parseIssueTarget(issue.project.key, parsed.data.target);
  if (!number) return fail(`Enter an issue key like ${issue.project.key}-12`);

  const other = await prisma.issue.findUnique({
    where: { projectId_number: { projectId: issue.projectId, number } },
    select: { id: true, number: true },
  });
  if (!other) return fail(RELATION_ERRORS.notFound);

  try {
    if (parsed.data.kind === "sub_issue") {
      await changeSubIssue({
        mode,
        userId: user.id,
        projectId: issue.projectId,
        projectKey: issue.project.key,
        parent: { id: issue.id, number: issue.number },
        child: other,
      });
    } else {
      await changeLink({
        mode,
        userId: user.id,
        projectId: issue.projectId,
        projectKey: issue.project.key,
        issue: { id: issue.id, number: issue.number },
        other,
        kind: parsed.data.kind,
      });
    }
  } catch (error) {
    if (error instanceof RelationError) return fail(error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail(RELATION_ERRORS.duplicate);
    console.error(error);
    return fail("Could not update the relation. Please try again.");
  }

  revalidateIssue(issue.project.key, [issue.number, other.number]);
  return ok({ otherIssueId: other.id });
}

class RelationError extends Error {}

async function changeLink(input: {
  mode: "add" | "remove";
  userId: string;
  projectId: string;
  projectKey: string;
  issue: { id: string; number: number };
  other: { id: string; number: number };
  kind: RelationKind;
}) {
  const rows = await prisma.issueRelation.findMany({
    where: { projectId: input.projectId },
    select: { type: true, fromIssueId: true, toIssueId: true },
  });
  const relations: PlannedEdge[] = [];
  for (const row of rows) {
    if (row.type === "blocks" || row.type === "related") {
      relations.push({ type: row.type, fromIssueId: row.fromIssueId, toIssueId: row.toIssueId });
    }
  }
  const request = { issueId: input.issue.id, otherIssueId: input.other.id, kind: input.kind };
  const result = input.mode === "add" ? addRelation(relations, request) : removeRelation(relations, request);
  if (!result.ok) throw new RelationError(result.error);

  const issueKey = formatIssueKey(input.projectKey, input.issue.number);
  const otherKey = formatIssueKey(input.projectKey, input.other.number);
  const type = input.mode === "add" ? "relation_added" : "relation_removed";
  await prisma.$transaction(async (tx) => {
    if (input.mode === "add") {
      await tx.issueRelation.create({
        data: { projectId: input.projectId, ...result.edge },
      });
    } else {
      await tx.issueRelation.deleteMany({
        where: { projectId: input.projectId, ...result.edge },
      });
    }
    await tx.activity.createMany({
      data: [
        {
          issueId: input.issue.id,
          actorId: input.userId,
          type,
          payload: JSON.stringify({ role: input.kind, key: otherKey }),
        },
        {
          issueId: input.other.id,
          actorId: input.userId,
          type,
          payload: JSON.stringify({ role: otherRole(input.kind), key: issueKey }),
        },
      ],
    });
  });
}

async function changeSubIssue(input: {
  mode: "add" | "remove";
  userId: string;
  projectId: string;
  projectKey: string;
  parent: { id: string; number: number };
  child: { id: string; number: number };
}) {
  const issues = await prisma.issue.findMany({
    where: { projectId: input.projectId },
    select: { id: true, parentId: true },
  });
  const result = input.mode === "add"
    ? addSubIssue(issues, input.parent.id, input.child.id)
    : removeSubIssue(issues, input.parent.id, input.child.id);
  if (!result.ok) throw new RelationError(result.error);

  const parentKey = formatIssueKey(input.projectKey, input.parent.number);
  const childKey = formatIssueKey(input.projectKey, input.child.number);
  const type = input.mode === "add" ? "subissue_added" : "subissue_removed";
  await prisma.$transaction(async (tx) => {
    const updated = await tx.issue.updateMany({
      where: {
        id: input.child.id,
        parentId: input.mode === "add" ? null : input.parent.id,
      },
      data: { parentId: input.mode === "add" ? input.parent.id : null },
    });
    if (updated.count !== 1) throw new RelationError(input.mode === "add" ? RELATION_ERRORS.subParent : RELATION_ERRORS.subMissing);
    await tx.activity.createMany({
      data: [
        {
          issueId: input.parent.id,
          actorId: input.userId,
          type,
          payload: JSON.stringify({ role: "child", key: childKey }),
        },
        {
          issueId: input.child.id,
          actorId: input.userId,
          type,
          payload: JSON.stringify({ role: "parent", key: parentKey }),
        },
      ],
    });
  });
}
