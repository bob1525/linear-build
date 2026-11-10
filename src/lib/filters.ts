import { isPriority, isStatus, UNASSIGNED, type Priority, type Status } from "@/lib/constants";

export type FilterableIssue = {
  title: string;
  description: string;
  key: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  labelIds: string[];
};

export type IssueFilters = {
  statuses: Status[];
  priorities: Priority[];
  assignees: string[];
  labels: string[];
  query: string;
};

export function emptyFilters(): IssueFilters {
  return { statuses: [], priorities: [], assignees: [], labels: [], query: "" };
}

function readList(value: string | string[] | undefined) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return [...new Set(raw.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function parseFilters(input: Record<string, string | string[] | undefined>): IssueFilters {
  const queryValue = input.q;
  const query = (Array.isArray(queryValue) ? (queryValue[0] ?? "") : (queryValue ?? "")).trim();
  return {
    statuses: readList(input.status).filter(isStatus),
    priorities: readList(input.priority).filter(isPriority),
    assignees: readList(input.assignee),
    labels: readList(input.label),
    query,
  };
}

export function hasActiveFilters(filters: IssueFilters) {
  return (
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.query.length > 0
  );
}

export function toSearchParams(filters: IssueFilters) {
  const params = new URLSearchParams();
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.priorities.length) params.set("priority", filters.priorities.join(","));
  if (filters.assignees.length) params.set("assignee", filters.assignees.join(","));
  if (filters.labels.length) params.set("label", filters.labels.join(","));
  if (filters.query) params.set("q", filters.query);
  return params;
}

export function issueMatchesFilters(issue: FilterableIssue, filters: IssueFilters) {
  if (filters.statuses.length > 0 && !filters.statuses.includes(issue.status as Status)) return false;
  if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority as Priority)) return false;
  if (filters.assignees.length > 0) {
    const assigneeId = issue.assigneeId ?? UNASSIGNED;
    if (!filters.assignees.includes(assigneeId)) return false;
  }
  if (filters.labels.length > 0 && !filters.labels.some((labelId) => issue.labelIds.includes(labelId))) {
    return false;
  }
  if (filters.query) {
    const haystack = `${issue.key}\n${issue.title}\n${issue.description}`.toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }
  return true;
}

export function toFilterableIssue(issue: {
  title: string;
  description: string;
  key: string;
  status: string;
  priority: string;
  assignee: { id: string } | null;
  labels: { id: string }[];
}): FilterableIssue {
  return {
    title: issue.title,
    description: issue.description,
    key: issue.key,
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assignee?.id ?? null,
    labelIds: issue.labels.map((label) => label.id),
  };
}
