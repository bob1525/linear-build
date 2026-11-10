import { isPriority, isStatus } from "@/lib/constants";
import { emptyFilters, toSearchParams, type IssueFilters } from "@/lib/filters";

export const VIEW_TYPES = ["board", "list"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export const ISSUE_SORTS = [
  { id: "priority", label: "Priority" },
  { id: "newest", label: "Newest" },
  { id: "title", label: "Title" },
  { id: "due", label: "Due date" },
] as const;

export type IssueSort = (typeof ISSUE_SORTS)[number]["id"];

const VIEW_QUERY_KEYS = ["status", "priority", "assignee", "label", "q", "sort", "view", "all"] as const;

export function isViewType(value: string): value is ViewType {
  return VIEW_TYPES.some((view) => view === value);
}

export function isIssueSort(value: string): value is IssueSort {
  return ISSUE_SORTS.some((sort) => sort.id === value);
}

export function parseSort(value: string | string[] | undefined): IssueSort {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return isIssueSort(raw) ? raw : "priority";
}

export function normalizeFilters(filters: IssueFilters): IssueFilters {
  const allowedStatuses = filters.statuses.filter(isStatus);
  const allowedPriorities = filters.priorities.filter(isPriority);
  return {
    statuses: unique(allowedStatuses),
    priorities: unique(allowedPriorities),
    assignees: unique(filters.assignees.map((id) => id.trim()).filter(Boolean)),
    labels: unique(filters.labels.map((id) => id.trim()).filter(Boolean)),
    query: filters.query.trim(),
  };
}

export function sameFilters(left: IssueFilters, right: IssueFilters) {
  return JSON.stringify(normalizeFilters(left)) === JSON.stringify(normalizeFilters(right));
}

export function hasExplicitViewQuery(input: Record<string, string | string[] | undefined>) {
  return VIEW_QUERY_KEYS.some((key) => {
    const value = input[key];
    if (Array.isArray(value)) return value.some((item) => item.trim().length > 0);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function viewHref(projectKey: string, viewType: ViewType, filters: IssueFilters, sort: IssueSort, viewId?: string) {
  const params = toSearchParams(normalizeFilters(filters));
  if (sort !== "priority") params.set("sort", sort);
  if (viewId) params.set("view", viewId);
  const path = viewType === "list" ? `/p/${projectKey}/list` : `/p/${projectKey}`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function searchBasePath(pathname: string) {
  const match = pathname.match(/^\/p\/[^/]+/);
  if (!match) return pathname;
  return pathname.startsWith(`${match[0]}/list`) ? `${match[0]}/list` : match[0];
}

export function parseStoredFilters(raw: string): IssueFilters {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyFilters();
    const record = parsed as Record<string, unknown>;
    return normalizeFilters({
      statuses: stringList(record.statuses).filter(isStatus),
      priorities: stringList(record.priorities).filter(isPriority),
      assignees: stringList(record.assignees),
      labels: stringList(record.labels),
      query: typeof record.query === "string" ? record.query : "",
    });
  } catch {
    return emptyFilters();
  }
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
