import { priorityRank, type Status } from "@/lib/constants";

export function compareIssues<T extends { priority: string; number: number }>(a: T, b: T) {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;
  return a.number - b.number;
}

export function groupByStatus<T extends { status: Status; priority: string; number: number }>(issues: T[]) {
  const groups: Record<Status, T[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const issue of [...issues].sort(compareIssues)) {
    groups[issue.status].push(issue);
  }
  return groups;
}
