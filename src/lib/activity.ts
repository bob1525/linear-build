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
    case "relation_added":
    case "relation_removed":
      return describeRelation(type === "relation_added", data);
    case "subissue_added":
      return data.role === "parent" ? `set the parent to ${keyOf(data)}` : `added ${keyOf(data)} as a sub-issue`;
    case "subissue_removed":
      return data.role === "parent" ? `cleared the parent ${keyOf(data)}` : `removed sub-issue ${keyOf(data)}`;
    default:
      return "updated the issue";
  }
}

function keyOf(data: Record<string, unknown>) {
  return typeof data.key === "string" && data.key.length > 0 ? data.key : "an issue";
}

function describeRelation(added: boolean, data: Record<string, unknown>) {
  const key = keyOf(data);
  if (data.role === "blocked_by") return added ? `marked this issue as blocked by ${key}` : `is no longer blocked by ${key}`;
  if (data.role === "blocks") return added ? `marked this issue as blocking ${key}` : `no longer blocks ${key}`;
  if (data.role === "related") return added ? `related this issue to ${key}` : `removed the relation to ${key}`;
  return added ? "added a relation" : "removed a relation";
}

export function formatActivityLine(actor: string, type: string, payload: unknown) {
  return `${actor} ${describeActivity(type, payload)}`;
}
