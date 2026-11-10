import { isStatus, type Status } from "@/lib/constants";

export type BatchIssue = {
  id: string;
  key: string;
  status: string;
  assigneeId: string | null;
  labelIds: string[];
};

export type BatchOp =
  | { type: "status"; status: Status }
  | { type: "assignee"; assigneeId: string | null }
  | { type: "add_label"; labelId: string }
  | { type: "remove_label"; labelId: string }
  | { type: "delete" };

export type BatchSuccess = { id: string; key: string };
export type BatchFailure = { id: string; key: string | null; error: string };
export type BatchResult = { succeeded: BatchSuccess[]; failed: BatchFailure[] };

export const BATCH_ERRORS = {
  missing: "Issue not found",
  status: "Status is invalid",
  assignee: "Assignee is not a member of this project",
  label: "That label is not in this project",
} as const;

export type SelectionState = { selected: string[]; anchor: string | null };

export function planBatch(
  issues: BatchIssue[],
  ids: string[],
  op: BatchOp,
  context: { memberIds: string[]; labelIds: string[] },
): BatchResult {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const succeeded: BatchSuccess[] = [];
  const failed: BatchFailure[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const issue = byId.get(id);
    if (!issue) {
      failed.push({ id, key: null, error: BATCH_ERRORS.missing });
      continue;
    }
    const error = rejection(op, context);
    if (error) {
      failed.push({ id: issue.id, key: issue.key, error });
      continue;
    }
    succeeded.push({ id: issue.id, key: issue.key });
  }
  return { succeeded, failed };
}

export function applyBatchOp(issue: BatchIssue, op: BatchOp): BatchIssue | null {
  if (op.type === "delete") return null;
  if (op.type === "status") return { ...issue, status: op.status };
  if (op.type === "assignee") return { ...issue, assigneeId: op.assigneeId };
  const labels = new Set(issue.labelIds);
  if (op.type === "add_label") labels.add(op.labelId);
  if (op.type === "remove_label") labels.delete(op.labelId);
  return { ...issue, labelIds: [...labels].sort() };
}

export function batchSummary(result: BatchResult) {
  return `${result.succeeded.length} succeeded, ${result.failed.length} failed`;
}

export function selectionFromPointer(
  state: SelectionState,
  orderedIds: string[],
  id: string,
  mods: { shift: boolean; toggle: boolean },
): SelectionState {
  if (!orderedIds.includes(id)) return state;
  if (mods.shift) return rangeSelected(state, orderedIds, id, mods.toggle);
  return toggleSelected(state, id);
}

export function selectAll(orderedIds: string[]): SelectionState {
  return { selected: [...orderedIds], anchor: orderedIds[0] ?? null };
}

export function emptySelection(): SelectionState {
  return { selected: [], anchor: null };
}

function toggleSelected(state: SelectionState, id: string): SelectionState {
  const selected = state.selected.includes(id) ? state.selected.filter((item) => item !== id) : [...state.selected, id];
  return { selected, anchor: id };
}

function rangeSelected(state: SelectionState, orderedIds: string[], id: string, additive: boolean): SelectionState {
  const anchor = state.anchor && orderedIds.includes(state.anchor) ? state.anchor : id;
  const start = orderedIds.indexOf(anchor);
  const end = orderedIds.indexOf(id);
  if (start < 0 || end < 0) return state;
  const [from, to] = start < end ? [start, end] : [end, start];
  const range = orderedIds.slice(from, to + 1);
  const selected = additive ? [...new Set([...state.selected, ...range])] : range;
  return { selected, anchor };
}

function rejection(op: BatchOp, context: { memberIds: string[]; labelIds: string[] }) {
  if (op.type === "status" && !isStatus(op.status)) return BATCH_ERRORS.status;
  if (op.type === "assignee" && op.assigneeId && !context.memberIds.includes(op.assigneeId)) return BATCH_ERRORS.assignee;
  if ((op.type === "add_label" || op.type === "remove_label") && !context.labelIds.includes(op.labelId)) return BATCH_ERRORS.label;
  return null;
}
