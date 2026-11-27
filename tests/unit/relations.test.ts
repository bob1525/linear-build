import { describe, expect, it } from "vitest";
import {
  RELATION_ERRORS,
  addRelation,
  addSubIssue,
  listRelations,
  parentOf,
  parseIssueTarget,
  removeRelation,
  removeSubIssue,
  subIssuesOf,
  type IssueParent,
  type PlannedEdge,
} from "@/lib/relations";

function added(relations: PlannedEdge[], issueId: string, otherIssueId: string, kind: "blocks" | "blocked_by" | "related") {
  const result = addRelation(relations, { issueId, otherIssueId, kind });
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const people: IssueParent[] = [
  { id: "parent", parentId: null },
  { id: "child", parentId: null },
  { id: "other", parentId: null },
  { id: "grandchild", parentId: null },
];

describe("issue relations", () => {
  it("creates a blocks edge and queries it from both issues", () => {
    const result = added([], "A", "B", "blocks");
    expect(result.edge).toEqual({ type: "blocks", fromIssueId: "A", toIssueId: "B" });
    expect(listRelations(result.relations, "A")).toEqual({ blocks: ["B"], blockedBy: [], related: [] });
    expect(listRelations(result.relations, "B")).toEqual({ blocks: [], blockedBy: ["A"], related: [] });
  });

  it("stores blocked-by as the inverse blocks edge", () => {
    const result = added([], "A", "B", "blocked_by");
    expect(result.edge).toEqual({ type: "blocks", fromIssueId: "B", toIssueId: "A" });
    expect(listRelations(result.relations, "A").blockedBy).toEqual(["B"]);
    expect(listRelations(result.relations, "B").blocks).toEqual(["A"]);
  });

  it("stores one related edge in id order and queries it from either issue", () => {
    const result = added([], "b", "a", "related");
    expect(result.edge).toEqual({ type: "related", fromIssueId: "a", toIssueId: "b" });
    expect(listRelations(result.relations, "a").related).toEqual(["b"]);
    expect(listRelations(result.relations, "b").related).toEqual(["a"]);
    expect(result.relations).toHaveLength(1);
  });

  it("rejects a duplicate blocks relation", () => {
    const first = added([], "A", "B", "blocks");
    const second = addRelation(first.relations, { issueId: "A", otherIssueId: "B", kind: "blocks" });
    expect(second).toEqual({ ok: false, error: RELATION_ERRORS.duplicate });
    expect(first.relations).toHaveLength(1);
  });

  it("treats the opposite related add as the same relation", () => {
    const first = added([], "a", "b", "related");
    const second = addRelation(first.relations, { issueId: "b", otherIssueId: "a", kind: "related" });
    expect(second).toEqual({ ok: false, error: RELATION_ERRORS.duplicate });
  });

  it("rejects a relation from an issue to itself", () => {
    expect(addRelation([], { issueId: "A", otherIssueId: "A", kind: "blocks" })).toEqual({
      ok: false,
      error: RELATION_ERRORS.self,
    });
    expect(addRelation([], { issueId: "A", otherIssueId: "A", kind: "related" }).ok).toBe(false);
    expect(addRelation([], { issueId: "A", otherIssueId: "A", kind: "blocked_by" }).ok).toBe(false);
  });

  it("forbids A blocks B while B blocks A", () => {
    const first = added([], "A", "B", "blocks");
    const reverse = addRelation(first.relations, { issueId: "B", otherIssueId: "A", kind: "blocks" });
    const inverse = addRelation(first.relations, { issueId: "A", otherIssueId: "B", kind: "blocked_by" });
    expect(reverse).toEqual({ ok: false, error: RELATION_ERRORS.cycle });
    expect(inverse).toEqual({ ok: false, error: RELATION_ERRORS.cycle });
    expect(listRelations(first.relations, "A").blocks).toEqual(["B"]);
    expect(listRelations(first.relations, "B").blocks).toEqual([]);
  });

  it("forbids a longer blocking cycle", () => {
    const first = added([], "A", "B", "blocks");
    const second = added(first.relations, "B", "C", "blocks");
    const cycle = addRelation(second.relations, { issueId: "C", otherIssueId: "A", kind: "blocks" });
    expect(cycle).toEqual({ ok: false, error: RELATION_ERRORS.cycle });
    expect(listRelations(second.relations, "C").blocks).toEqual([]);
  });

  it("deletes a blocks relation when described from the blocked issue", () => {
    const created = added([], "A", "B", "blocks");
    const removed = removeRelation(created.relations, { issueId: "B", otherIssueId: "A", kind: "blocked_by" });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(listRelations(removed.relations, "A")).toEqual({ blocks: [], blockedBy: [], related: [] });
    expect(listRelations(removed.relations, "B").blockedBy).toEqual([]);
  });

  it("deletes a related relation from the other side", () => {
    const created = added([], "a", "b", "related");
    const removed = removeRelation(created.relations, { issueId: "b", otherIssueId: "a", kind: "related" });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.relations).toEqual([]);
    expect(listRelations(removed.relations, "a").related).toEqual([]);
  });

  it("reports a missing relation on delete", () => {
    expect(removeRelation([], { issueId: "A", otherIssueId: "B", kind: "blocks" })).toEqual({
      ok: false,
      error: RELATION_ERRORS.missing,
    });
  });

  it("allows the reverse block after the original edge is removed", () => {
    const created = added([], "A", "B", "blocks");
    const removed = removeRelation(created.relations, { issueId: "A", otherIssueId: "B", kind: "blocks" });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    const reverse = added(removed.relations, "B", "A", "blocks");
    expect(listRelations(reverse.relations, "B").blocks).toEqual(["A"]);
    expect(listRelations(reverse.relations, "A").blockedBy).toEqual(["B"]);
  });

  it("queries only the edges that touch the issue", () => {
    const first = added([], "A", "B", "blocks");
    const second = added(first.relations, "B", "C", "blocks");
    const third = added(second.relations, "C", "D", "related");
    expect(listRelations(third.relations, "B")).toEqual({ blocks: ["C"], blockedBy: ["A"], related: [] });
    expect(listRelations(third.relations, "D")).toEqual({ blocks: [], blockedBy: [], related: ["C"] });
  });

  it("lets a related pair also have one blocking direction", () => {
    const related = added([], "A", "B", "related");
    const blocking = added(related.relations, "B", "A", "blocks");
    expect(listRelations(blocking.relations, "A")).toEqual({ blocks: [], blockedBy: ["B"], related: ["B"] });
    expect(blocking.relations).toHaveLength(2);
  });

  it("parses project keys and bare numbers", () => {
    expect(parseIssueTarget("ORB", "orb-12")).toBe(12);
    expect(parseIssueTarget("ORB", "4")).toBe(4);
    expect(parseIssueTarget("ORB", "ORB-0")).toBeNull();
    expect(parseIssueTarget("ORB", "Add saved views")).toBeNull();
  });
});

describe("sub-issues", () => {
  it("adds, queries, and removes one level of sub-issues", () => {
    const created = addSubIssue(people, "parent", "child");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(subIssuesOf(created.issues, "parent")).toEqual(["child"]);
    expect(parentOf(created.issues, "child")).toBe("parent");
    const removed = removeSubIssue(created.issues, "parent", "child");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(subIssuesOf(removed.issues, "parent")).toEqual([]);
    expect(parentOf(removed.issues, "child")).toBeNull();
  });

  it("rejects a grandchild, a second parent, and a self parent", () => {
    const created = addSubIssue(people, "parent", "child");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(addSubIssue(created.issues, "child", "grandchild")).toEqual({ ok: false, error: RELATION_ERRORS.subLevel });
    expect(addSubIssue(created.issues, "other", "child")).toEqual({ ok: false, error: RELATION_ERRORS.subParent });
    expect(addSubIssue(created.issues, "child", "child")).toEqual({ ok: false, error: RELATION_ERRORS.subSelf });
    expect(addSubIssue(created.issues, "parent", "child")).toEqual({ ok: false, error: RELATION_ERRORS.subDuplicate });
    expect(subIssuesOf(created.issues, "parent")).toEqual(["child"]);
  });

  it("rejects using a parent as a sub-issue and deleting a link that is not there", () => {
    const created = addSubIssue(people, "parent", "child");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(addSubIssue(created.issues, "other", "parent")).toEqual({ ok: false, error: RELATION_ERRORS.subLevel });
    expect(removeSubIssue(created.issues, "other", "child")).toEqual({ ok: false, error: RELATION_ERRORS.subMissing });
    expect(addSubIssue(created.issues, "missing", "child")).toEqual({ ok: false, error: RELATION_ERRORS.notFound });
  });
});
