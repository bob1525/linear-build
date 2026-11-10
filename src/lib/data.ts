import { cache } from "react";
import { getLastProjectKey } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueInclude, publicUserSelect, toActivityDTO, toCommentDTO, toIssueDTO, toLabelDTO, toProjectSummary } from "@/lib/dto";
import type { ActivityDTO, CommentDTO, IssueDTO, LabelDTO, ProjectSummary, UserDTO } from "@/lib/types";

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

export const getProjectPage = cache(async (userId: string, projectKey: string): Promise<ProjectPageData | null> => {
  const project = await loadAccessibleProject(userId, projectKey);
  if (!project) return null;
  const summary = toProjectSummary(project);
  return {
    project: summary,
    issues: project.issues.map((issue) => toIssueDTO(issue, project.key)),
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

  const summary = toProjectSummary(project);
  return {
    project: summary,
    issue: toIssueDTO(issue, project.key),
    comments: issue.comments.map(toCommentDTO),
    activities: issue.activities.map(toActivityDTO),
    members: summary.members,
    labels: project.labels.map((label) => toLabelDTO(label)).sort((a, b) => a.name.localeCompare(b.name)),
  };
});
