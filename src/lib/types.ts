import type { Priority, Status } from "@/lib/constants";
import type { IssueFilters } from "@/lib/filters";
import type { IssueSort, ViewType } from "@/lib/view-state";

export type UserDTO = {
  id: string;
  name: string;
  email: string;
};

export type LabelDTO = {
  id: string;
  name: string;
  color: string;
};

export type IssueDTO = {
  id: string;
  number: number;
  key: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserDTO | null;
  creator: UserDTO;
  labels: LabelDTO[];
  commentCount: number;
  blocksCount: number;
  blockedByCount: number;
};

export type IssueLinkDTO = {
  issueId: string;
  key: string;
  number: number;
  title: string;
  status: Status;
};

export type IssueRelationGroups = {
  blocks: IssueLinkDTO[];
  blockedBy: IssueLinkDTO[];
  related: IssueLinkDTO[];
  parent: IssueLinkDTO | null;
  subIssues: IssueLinkDTO[];
};

export type IssueCandidate = {
  key: string;
  title: string;
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  author: UserDTO;
};

export type ActivityDTO = {
  id: string;
  type: string;
  payload: string;
  createdAt: string;
  actor: UserDTO;
};

export type SavedViewDTO = {
  id: string;
  name: string;
  viewType: ViewType;
  sort: IssueSort;
  filters: IssueFilters;
  isDefault: boolean;
};

export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  issueCount: number;
  members: UserDTO[];
  labels: LabelDTO[];
};

export type ConflictDetails = {
  updatedAt: string;
  actorName: string | null;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; conflict?: ConflictDetails };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export function conflict(error: string, details: ConflictDetails): ActionResult<never> {
  return { ok: false, error, conflict: details };
}
