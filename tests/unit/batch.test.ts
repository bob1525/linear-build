import { describe, expect, it } from "vitest";
import { CONFLICT_ERROR } from "@/lib/concurrency";
import {
  BATCH_ERRORS,
  applyBatchOp,
  batchSummary,
  emptySelection,
  planBatch,
  selectAll,
  selectionFromPointer,
  type BatchIssue,
} from "@/lib/batch";

const context = { memberIds: ["ava", "marcus"], labelIds: ["bug", "feature"] };

function issue(overrides: Partial<BatchIssue> = {}): BatchIssue {
  return {
    id: "a",
    key: "ORB-1",
    status: "todo",
    assigneeId: null,
    labelIds: ["bug"],
    ...overrides,
  };
}

describe("batch status", () => {
  it("plans a status change for every selected issue and does not mutate them", () => {
    const first = issue();
    const second = issue({ id: "b", key: "ORB-2", status: "backlog" });
    const before = [first, second];
    const plan = planBatch(before, ["a", "b"], { type: "status", status: "done" }, context);
    expect(plan.succeeded.map((item) => item.key)).toEqual(["ORB-1", "ORB-2"]);
    expect(plan.failed).toEqual([]);
    expect(first.status).toBe("todo");
    const next = applyBatchOp(first, { type: "status", status: "done" });
    expect(next?.status).toBe("done");
    expect(first.status).toBe("todo");
    expect(batchSummary(plan)).toBe("2 succeeded, 0 failed");
  });

  it("reports a missing issue and still updates the ones that exist", () => {
    const plan = planBatch([issue()], ["a", "missing", "a"], { type: "status", status: "in_progress" }, context);
    expect(plan.succeeded).toEqual([{ id: "a", key: "ORB-1" }]);
    expect(plan.failed).toEqual([{ id: "missing", key: null, error: BATCH_ERRORS.missing }]);
    expect(batchSummary(plan)).toBe("1 succeeded, 1 failed");
  });

  it("holds back a stale issue and still plans the one that matches", () => {
    const stale = issue({ updatedAt: "2026-01-02T00:00:00.000Z", baseUpdatedAt: "2026-01-01T00:00:00.000Z" });
    const fresh = issue({
      id: "b",
      key: "ORB-2",
      updatedAt: "2026-01-01T00:00:00.000Z",
      baseUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = planBatch([stale, fresh], ["a", "b"], { type: "status", status: "done" }, context);
    expect(plan.succeeded).toEqual([{ id: "b", key: "ORB-2" }]);
    expect(plan.failed).toEqual([{ id: "a", key: "ORB-1", error: CONFLICT_ERROR }]);
    expect(stale.status).toBe("todo");
  });

  it("rejects an invalid status without marking those issues updated", () => {
    const plan = planBatch([issue(), issue({ id: "b", key: "ORB-2" })], ["a", "gone", "b"], { type: "status", status: "later" as "done" }, context);
    expect(plan.succeeded).toEqual([]);
    expect(plan.failed.map((item) => item.error)).toEqual([BATCH_ERRORS.status, BATCH_ERRORS.missing, BATCH_ERRORS.status]);
  });
});

describe("batch assignee and labels", () => {
  it("rejects an assignee who is not a member and allows unassigning", () => {
    const issues = [issue({ id: "a", assigneeId: "ava" }), issue({ id: "b", key: "ORB-2" })];
    const denied = planBatch(issues, ["a", "b"], { type: "assignee", assigneeId: "outsider" }, context);
    expect(denied.succeeded).toEqual([]);
    expect(denied.failed.every((item) => item.error === BATCH_ERRORS.assignee)).toBe(true);
    const cleared = planBatch(issues, ["a"], { type: "assignee", assigneeId: null }, context);
    expect(cleared.succeeded).toEqual([{ id: "a", key: "ORB-1" }]);
    expect(applyBatchOp(issues[0]!, { type: "assignee", assigneeId: null })?.assigneeId).toBeNull();
    expect(issues[0]!.assigneeId).toBe("ava");
  });

  it("adds and removes a project label without changing the original issue", () => {
    const current = issue({ labelIds: ["bug"] });
    expect(planBatch([current], ["a"], { type: "add_label", labelId: "feature" }, context).failed).toEqual([]);
    const added = applyBatchOp(current, { type: "add_label", labelId: "feature" });
    expect(added?.labelIds).toEqual(["bug", "feature"]);
    expect(current.labelIds).toEqual(["bug"]);
    expect(applyBatchOp(current, { type: "remove_label", labelId: "bug" })?.labelIds).toEqual([]);
    const unknown = planBatch([current], ["a"], { type: "add_label", labelId: "nope" }, context);
    expect(unknown.failed[0]?.error).toBe(BATCH_ERRORS.label);
  });

  it("treats delete as success for issues that exist and failure for the rest", () => {
    const current = issue();
    const plan = planBatch([current], ["a", "gone"], { type: "delete" }, context);
    expect(plan.succeeded).toEqual([{ id: "a", key: "ORB-1" }]);
    expect(plan.failed).toEqual([{ id: "gone", key: null, error: BATCH_ERRORS.missing }]);
    expect(applyBatchOp(current, { type: "delete" })).toBeNull();
    expect(current.id).toBe("a");
  });
});

describe("multi-select", () => {
  const ordered = ["a", "b", "c", "d"];

  it("toggles with a plain or modified click and does not change the previous state object", () => {
    const start = emptySelection();
    const once = selectionFromPointer(start, ordered, "b", { shift: false, toggle: false });
    expect(once).toEqual({ selected: ["b"], anchor: "b" });
    expect(start.selected).toEqual([]);
    const twice = selectionFromPointer(once, ordered, "d", { shift: false, toggle: true });
    expect(twice.selected).toEqual(["b", "d"]);
    const cleared = selectionFromPointer(twice, ordered, "b", { shift: false, toggle: true });
    expect(cleared.selected).toEqual(["d"]);
    expect(selectionFromPointer(cleared, ordered, "z", { shift: false, toggle: true })).toBe(cleared);
  });

  it("shift-click selects the inclusive range and shift-cmd adds it", () => {
    const anchored = selectionFromPointer(emptySelection(), ordered, "a", { shift: false, toggle: false });
    const range = selectionFromPointer(anchored, ordered, "c", { shift: true, toggle: false });
    expect(range).toEqual({ selected: ["a", "b", "c"], anchor: "a" });
    const extra = selectionFromPointer(range, ordered, "b", { shift: false, toggle: true });
    expect(extra.selected).toEqual(["a", "c"]);
    const added = selectionFromPointer({ selected: ["d"], anchor: "d" }, ordered, "b", { shift: true, toggle: true });
    expect(added.selected).toEqual(["d", "b", "c"]);
    expect(added.anchor).toBe("d");
  });

  it("selects every visible id and can clear back to empty", () => {
    expect(selectAll(ordered)).toEqual({ selected: ["a", "b", "c", "d"], anchor: "a" });
    expect(selectAll([])).toEqual({ selected: [], anchor: null });
    expect(ordered).toEqual(["a", "b", "c", "d"]);
  });
});
