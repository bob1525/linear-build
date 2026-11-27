import type { Prisma } from "@prisma/client";
import { asPriority, asStatus } from "@/lib/constants";
import { formatIssueKey } from "@/lib/format";
import type { ActivityDTO, CommentDTO, IssueDTO, LabelDTO, ProjectSummary, UserDTO } from "@/lib/types";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export const issueInclude = {
  assignee: { select: publicUserSelect },
  creator: { select: publicUserSelect },
  labels: { include: { label: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.IssueInclude;

type IssueRecord = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;

export function toUserDTO(user: UserDTO): UserDTO {
  return { id: user.id, name: user.name, email: user.email };
}

export function toLabelDTO(label: LabelDTO): LabelDTO {
  return { id: label.id, name: label.name, color: label.color };
}

export function toIssueDTO(
  issue: IssueRecord,
  projectKey: string,
  marks: { blocksCount: number; blockedByCount: number } = { blocksCount: 0, blockedByCount: 0 },
): IssueDTO {
  return {
    id: issue.id,
    number: issue.number,
    key: formatIssueKey(projectKey, issue.number),
    title: issue.title,
    description: issue.description,
    status: asStatus(issue.status),
    priority: asPriority(issue.priority),
    dueDate: issue.dueDate ? issue.dueDate.toISOString() : null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    assignee: issue.assignee ? toUserDTO(issue.assignee) : null,
    creator: toUserDTO(issue.creator),
    labels: issue.labels
      .map((row) => toLabelDTO(row.label))
      .sort((a, b) => a.name.localeCompare(b.name)),
    commentCount: issue._count.comments,
    blocksCount: marks.blocksCount,
    blockedByCount: marks.blockedByCount,
  };
}

export function toCommentDTO(comment: {
  id: string;
  body: string;
  createdAt: Date;
  author: UserDTO;
}): CommentDTO {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: toUserDTO(comment.author),
  };
}

export function toActivityDTO(activity: {
  id: string;
  type: string;
  payload: string;
  createdAt: Date;
  actor: UserDTO;
}): ActivityDTO {
  return {
    id: activity.id,
    type: activity.type,
    payload: activity.payload,
    createdAt: activity.createdAt.toISOString(),
    actor: toUserDTO(activity.actor),
  };
}

export function toProjectSummary(project: {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  _count: { issues: number };
  members: { user: UserDTO }[];
  labels: LabelDTO[];
}): ProjectSummary {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    color: project.color,
    issueCount: project._count.issues,
    members: project.members.map((member) => toUserDTO(member.user)),
    labels: project.labels.map(toLabelDTO).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
