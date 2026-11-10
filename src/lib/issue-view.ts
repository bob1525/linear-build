import { priorityRank, type Status } from "@/lib/constants";
import type { IssueSort } from "@/lib/view-state";

type Sortable = { priority: string; number: number; title?: string; dueDate?: string | null };

export function compareIssues<T extends Sortable>(a: T, b: T, sort: IssueSort = "priority") {
  if (sort === "newest") return b.number - a.number;
  if (sort === "title") {
    const byTitle = (a.title ?? "").localeCompare(b.title ?? "");
    if (byTitle !== 0) return byTitle;
    return a.number - b.number;
  }
  if (sort === "due") {
    const byDue = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    if (byDue !== 0) return byDue;
    return a.number - b.number;
  }
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;
  return a.number - b.number;
}

export function groupByStatus<T extends Sortable & { status: Status }>(issues: T[], sort: IssueSort = "priority") {
  const groups: Record<Status, T[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const issue of [...issues].sort((left, right) => compareIssues(left, right, sort))) {
    groups[issue.status].push(issue);
  }
  return groups;
}
