export type RelationKind = "blocks" | "blocked_by" | "related";

export type StoredRelationType = "blocks" | "related";

export type PlannedEdge = {
  type: StoredRelationType;
  fromIssueId: string;
  toIssueId: string;
};

export type RelationLists = {
  blocks: string[];
  blockedBy: string[];
  related: string[];
};

export type IssueParent = {
  id: string;
  parentId: string | null;
};

export const RELATION_ERRORS = {
  self: "Choose a different issue",
  duplicate: "That relation already exists",
  cycle: "That would create a blocking cycle",
  missing: "That relation does not exist",
  subSelf: "An issue can't be a sub-issue of itself",
  subLevel: "Sub-issues can't contain other sub-issues",
  subParent: "This issue already belongs to another issue",
  subDuplicate: "This issue is already a sub-issue of that issue",
  subMissing: "That sub-issue does not exist",
  notFound: "Issue not found",
} as const;

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

function sameEdge(a: PlannedEdge, b: PlannedEdge) {
  return a.type === b.type && a.fromIssueId === b.fromIssueId && a.toIssueId === b.toIssueId;
}

export function normalizeRelation(issueId: string, otherIssueId: string, kind: RelationKind): PlannedEdge {
  if (kind === "blocks") return { type: "blocks", fromIssueId: issueId, toIssueId: otherIssueId };
  if (kind === "blocked_by") return { type: "blocks", fromIssueId: otherIssueId, toIssueId: issueId };
  const [fromIssueId, toIssueId] = issueId < otherIssueId ? [issueId, otherIssueId] : [otherIssueId, issueId];
  return { type: "related", fromIssueId, toIssueId };
}

export function blocksWouldCycle(relations: PlannedEdge[], fromIssueId: string, toIssueId: string) {
  if (fromIssueId === toIssueId) return true;
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.type !== "blocks") continue;
    const next = outgoing.get(relation.fromIssueId) ?? [];
    next.push(relation.toIssueId);
    outgoing.set(relation.fromIssueId, next);
  }
  const pending = [toIssueId];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || seen.has(current)) continue;
    if (current === fromIssueId) return true;
    seen.add(current);
    for (const next of outgoing.get(current) ?? []) pending.push(next);
  }
  return false;
}

export function addRelation(
  relations: PlannedEdge[],
  input: { issueId: string; otherIssueId: string; kind: RelationKind },
): Ok<{ relations: PlannedEdge[]; edge: PlannedEdge }> | Err {
  if (input.issueId === input.otherIssueId) return { ok: false, error: RELATION_ERRORS.self };
  const edge = normalizeRelation(input.issueId, input.otherIssueId, input.kind);
  if (relations.some((relation) => sameEdge(relation, edge))) return { ok: false, error: RELATION_ERRORS.duplicate };
  if (edge.type === "blocks" && blocksWouldCycle(relations, edge.fromIssueId, edge.toIssueId)) {
    return { ok: false, error: RELATION_ERRORS.cycle };
  }
  return { ok: true, relations: [...relations, edge], edge };
}

export function removeRelation(
  relations: PlannedEdge[],
  input: { issueId: string; otherIssueId: string; kind: RelationKind },
): Ok<{ relations: PlannedEdge[]; edge: PlannedEdge }> | Err {
  if (input.issueId === input.otherIssueId) return { ok: false, error: RELATION_ERRORS.self };
  const edge = normalizeRelation(input.issueId, input.otherIssueId, input.kind);
  if (!relations.some((relation) => sameEdge(relation, edge))) return { ok: false, error: RELATION_ERRORS.missing };
  return { ok: true, relations: relations.filter((relation) => !sameEdge(relation, edge)), edge };
}

export function listRelations(relations: PlannedEdge[], issueId: string): RelationLists {
  const blocks: string[] = [];
  const blockedBy: string[] = [];
  const related: string[] = [];
  for (const relation of relations) {
    if (relation.type === "blocks" && relation.fromIssueId === issueId) blocks.push(relation.toIssueId);
    else if (relation.type === "blocks" && relation.toIssueId === issueId) blockedBy.push(relation.fromIssueId);
    else if (relation.type === "related" && relation.fromIssueId === issueId) related.push(relation.toIssueId);
    else if (relation.type === "related" && relation.toIssueId === issueId) related.push(relation.fromIssueId);
  }
  blocks.sort();
  blockedBy.sort();
  related.sort();
  return { blocks, blockedBy, related };
}

export function addSubIssue(issues: IssueParent[], parentId: string, childId: string): Ok<{ issues: IssueParent[] }> | Err {
  if (parentId === childId) return { ok: false, error: RELATION_ERRORS.subSelf };
  const parent = issues.find((issue) => issue.id === parentId);
  const child = issues.find((issue) => issue.id === childId);
  if (!parent || !child) return { ok: false, error: RELATION_ERRORS.notFound };
  if (parent.parentId || issues.some((issue) => issue.parentId === childId)) {
    return { ok: false, error: RELATION_ERRORS.subLevel };
  }
  if (child.parentId === parentId) return { ok: false, error: RELATION_ERRORS.subDuplicate };
  if (child.parentId) return { ok: false, error: RELATION_ERRORS.subParent };
  return {
    ok: true,
    issues: issues.map((issue) => (issue.id === childId ? { ...issue, parentId } : issue)),
  };
}

export function removeSubIssue(issues: IssueParent[], parentId: string, childId: string): Ok<{ issues: IssueParent[] }> | Err {
  const child = issues.find((issue) => issue.id === childId);
  if (!child || child.parentId !== parentId) return { ok: false, error: RELATION_ERRORS.subMissing };
  return {
    ok: true,
    issues: issues.map((issue) => (issue.id === childId ? { ...issue, parentId: null } : issue)),
  };
}

export function subIssuesOf(issues: IssueParent[], parentId: string) {
  return issues
    .filter((issue) => issue.parentId === parentId)
    .map((issue) => issue.id)
    .sort();
}

export function parentOf(issues: IssueParent[], issueId: string) {
  return issues.find((issue) => issue.id === issueId)?.parentId ?? null;
}

export function parseIssueTarget(projectKey: string, raw: string) {
  const value = raw.trim();
  const keyed = new RegExp(`^${projectKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i").exec(value);
  if (keyed?.[1]) {
    const number = Number(keyed[1]);
    return Number.isInteger(number) && number > 0 ? number : null;
  }
  if (/^\d+$/.test(value)) {
    const number = Number(value);
    return number > 0 ? number : null;
  }
  return null;
}
