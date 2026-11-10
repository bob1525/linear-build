export const STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;

export type Status = (typeof STATUSES)[number]["id"];

export const PRIORITIES = [
  { id: "urgent", label: "Urgent", rank: 0 },
  { id: "high", label: "High", rank: 1 },
  { id: "medium", label: "Medium", rank: 2 },
  { id: "low", label: "Low", rank: 3 },
  { id: "none", label: "No priority", rank: 4 },
] as const;

export type Priority = (typeof PRIORITIES)[number]["id"];

export const DEFAULT_LABELS = [
  { name: "Bug", color: "#e5484d" },
  { name: "Feature", color: "#5e6ad2" },
  { name: "Improvement", color: "#4cb782" },
  { name: "Design", color: "#f2994a" },
  { name: "Docs", color: "#8b8f98" },
  { name: "Performance", color: "#bb87fc" },
] as const;

export const PROJECT_COLORS = ["#5e6ad2", "#26b5ce", "#f2c94c", "#e5484d", "#4cb782", "#bb87fc"];

export const UNASSIGNED = "unassigned";

export function isStatus(value: string): value is Status {
  return STATUSES.some((status) => status.id === value);
}

export function isPriority(value: string): value is Priority {
  return PRIORITIES.some((priority) => priority.id === value);
}

export function asStatus(value: string): Status {
  return isStatus(value) ? value : "backlog";
}

export function asPriority(value: string): Priority {
  return isPriority(value) ? value : "none";
}

export function statusLabel(value: string): string {
  return STATUSES.find((status) => status.id === value)?.label ?? (value || "Unknown");
}

export function priorityLabel(value: string): string {
  return PRIORITIES.find((priority) => priority.id === value)?.label ?? (value || "Unknown");
}

export function priorityRank(value: string): number {
  return PRIORITIES.find((priority) => priority.id === value)?.rank ?? 99;
}
