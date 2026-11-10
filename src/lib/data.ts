import { cache } from "react";
import { getLastProjectKey } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueInclude, publicUserSelect, toActivityDTO, toCommentDTO, toIssueDTO, toLabelDTO, toProjectSummary } from "@/lib/dto";
import type { ActivityDTO, CommentDTO, IssueCandidate, IssueDTO, IssueLinkDTO, IssueRelationGroups, LabelDTO, ProjectSummary, UserDTO } from "@/lib/types";
import { asStatus } from "@/lib/constants";
import { formatIssueKey } from "@/lib/format";

export type ProjectPageData = {
  project: ProjectSummary;
  issues: IssueDTO[];
  members: UserDTO[];
  labels: LabelDTO[];
};

export type IssuePageData = {
  project: ProjectSummary;
  issue: IssueDTO;
  comments: CommentDTO[];
  activities: ActivityDTO[];
  members: UserDTO[];
  labels: LabelDTO[];
  relations: IssueRelationGroups;
  candidates: IssueCandidate[];
};

const projectShellInclude = {
  labels: { orderBy: { name: "asc" as const } },
  members: {
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { issues: true } },
};

export async function getProjectsForUser(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: { include: projectShellInclude } },
  });
  return memberships
    .map((membership) => membership.project)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(toProjectSummary);
}

export async function getLandingPath(userId: string) {
  const projects = await getProjectsForUser(userId);
  const lastKey = await getLastProjectKey();
  const project = projects.find((item) => item.key === lastKey) ?? projects[0];
  return project ? `/p/${project.key}` : "/welcome";
}

async function loadAccessibleProject(userId: string, projectKey: string) {
  const project = await prisma.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    include: {
      ...projectShellInclude,
      issues: { include: issueInclude, orderBy: { number: "asc" } },
    },
  });
  if (!project) return null;
  if (!project.members.some((member) => member.userId === userId)) return null;
  return project;
}

const linkSelect = { id: true, number: true, title: true, status: true } as const;

function toLink(issue: { id: string; number: number; title: string; status: string }, projectKey: string): IssueLinkDTO {
  return {
    issueId: issue.id,
    number: issue.number,
    key: formatIssueKey(projectKey, issue.number),
    title: issue.title,
    status: asStatus(issue.status),
  };
}

function blockingCounts(relations: { type: string; fromIssueId: string; toIssueId: string }[]) {
  const blocksCount = new Map<string, number>();
  const blockedByCount = new Map<string, number>();
  for (const relation of relations) {
    if (relation.type !== "blocks") continue;
    blocksCount.set(relation.fromIssueId, (blocksCount.get(relation.fromIssueId) ?? 0) + 1);
    blockedByCount.set(relation.toIssueId, (blockedByCount.get(relation.toIssueId) ?? 0) + 1);
  }
  return { blocksCount, blockedByCount };
}

export const getProjectPage = cache(async (userId: string, projectKey: string): Promise<ProjectPageData | null> => {
  const project = await loadAccessibleProject(userId, projectKey);
  if (!project) return null;
  const relations = await prisma.issueRelation.findMany({
    where: { projectId: project.id, type: "blocks" },
    select: { type: true, fromIssueId: true, toIssueId: true },
  });
  const counts = blockingCounts(relations);
  const summary = toProjectSummary(project);
  return {
    project: summary,
    issues: project.issues.map((issue) =>
      toIssueDTO(issue, project.key, {
        blocksCount: counts.blocksCount.get(issue.id) ?? 0,
        blockedByCount: counts.blockedByCount.get(issue.id) ?? 0,
      }),
    ),
    members: summary.members,
    labels: summary.labels,
  };
});

export const getIssuePage = cache(async (userId: string, projectKey: string, number: number): Promise<IssuePageData | null> => {
  const project = await prisma.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    include: projectShellInclude,
  });
  if (!project || !project.members.some((member) => member.userId === userId)) return null;

  const issue = await prisma.issue.findUnique({
    where: { projectId_number: { projectId: project.id, number } },
    include: {
      ...issueInclude,
      parent: { select: linkSelect },
      children: { select: linkSelect, orderBy: { number: "asc" } },
      comments: {
        include: { author: { select: publicUserSelect } },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        include: { actor: { select: publicUserSelect } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!issue) return null;

  const [relationRows, others] = await Promise.all([
    prisma.issueRelation.findMany({
      where: { projectId: project.id, OR: [{ fromIssueId: issue.id }, { toIssueId: issue.id }] },
      include: { fromIssue: { select: linkSelect }, toIssue: { select: linkSelect } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.issue.findMany({
      where: { projectId: project.id, NOT: { id: issue.id } },
      select: { number: true, title: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const blocks: IssueLinkDTO[] = [];
  const blockedBy: IssueLinkDTO[] = [];
  const related: IssueLinkDTO[] = [];
  for (const relation of relationRows) {
    if (relation.type === "blocks" && relation.fromIssueId === issue.id) blocks.push(toLink(relation.toIssue, project.key));
    else if (relation.type === "blocks" && relation.toIssueId === issue.id) blockedBy.push(toLink(relation.fromIssue, project.key));
    else if (relation.type === "related") {
      const other = relation.fromIssueId === issue.id ? relation.toIssue : relation.fromIssue;
      related.push(toLink(other, project.key));
    }
  }
  const sortLinks = (links: IssueLinkDTO[]) => links.sort((a, b) => a.number - b.number);

  const summary = toProjectSummary(project);
  return {
    project: summary,
    issue: toIssueDTO(issue, project.key, {
      blocksCount: blocks.length,
      blockedByCount: blockedBy.length,
    }),
    comments: issue.comments.map(toCommentDTO),
    activities: issue.activities.map(toActivityDTO),
    members: summary.members,
    labels: project.labels.map((label) => toLabelDTO(label)).sort((a, b) => a.name.localeCompare(b.name)),
    relations: {
      blocks: sortLinks(blocks),
      blockedBy: sortLinks(blockedBy),
      related: sortLinks(related),
      parent: issue.parent ? toLink(issue.parent, project.key) : null,
      subIssues: issue.children.map((child) => toLink(child, project.key)),
    },
    candidates: others.map((other) => ({ key: formatIssueKey(project.key, other.number), title: other.title })),
  };
});
