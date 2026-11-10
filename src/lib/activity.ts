import { priorityLabel, statusLabel } from "@/lib/constants";
import { formatDueDate } from "@/lib/format";

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function describeActivity(type: string, payload: unknown) {
  const data = asRecord(payload);
  switch (type) {
    case "created":
      return "created the issue";
    case "commented":
      return "commented";
    case "status_changed":
      return `changed status from ${statusLabel(String(data.from ?? ""))} to ${statusLabel(String(data.to ?? ""))}`;
    case "priority_changed":
      return `set priority to ${priorityLabel(String(data.to ?? ""))}`;
    case "assignee_changed":
      return typeof data.toName === "string" && data.toName.length > 0
        ? `assigned ${data.toName}`
        : "cleared the assignee";
    case "due_date_changed":
      return typeof data.to === "string" && data.to.length > 0
        ? `set the due date to ${formatDueDate(data.to)}`
        : "cleared the due date";
    case "labels_changed": {
      const added = stringList(data.added);
      const removed = stringList(data.removed);
      if (added.length > 0 && removed.length === 0) return `added ${added.join(", ")}`;
      if (removed.length > 0 && added.length === 0) return `removed ${removed.join(", ")}`;
      return "updated labels";
    }
    case "title_changed":
      return "renamed the issue";
    case "description_changed":
      return "updated the description";
    default:
      return "updated the issue";
  }
}

export function formatActivityLine(actor: string, type: string, payload: unknown) {
  return `${actor} ${describeActivity(type, payload)}`;
}
