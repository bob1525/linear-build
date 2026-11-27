import { emptyFilters, type IssueFilters } from "@/lib/filters";
import { isIssueSort, isViewType, normalizeFilters, type IssueSort, type ViewType } from "@/lib/view-state";

export type SavedView = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  viewType: ViewType;
  sort: IssueSort;
  filters: IssueFilters;
  isDefault: boolean;
};

export const VIEW_ERRORS = {
  name: "Name the view",
  long: "That name is too long",
  duplicate: "A view with that name already exists",
  missing: "That view does not exist",
} as const;

const NAME_LIMIT = 40;

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

export function viewNameKey(name: string) {
  return name.trim().toLowerCase();
}

export function listViews(views: SavedView[], userId: string, projectId: string) {
  return views
    .filter((view) => view.userId === userId && view.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function createView(
  views: SavedView[],
  input: {
    id: string;
    userId: string;
    projectId: string;
    name: string;
    viewType: string;
    sort: string;
    filters: IssueFilters;
  },
): Ok<{ views: SavedView[]; view: SavedView }> | Err {
  const name = cleanName(input.name);
  if (!name.ok) return name;
  if (!isViewType(input.viewType) || !isIssueSort(input.sort)) return { ok: false, error: VIEW_ERRORS.missing };
  if (listViews(views, input.userId, input.projectId).some((view) => viewNameKey(view.name) === name.key)) {
    return { ok: false, error: VIEW_ERRORS.duplicate };
  }
  const view: SavedView = {
    id: input.id,
    userId: input.userId,
    projectId: input.projectId,
    name: name.value,
    viewType: input.viewType,
    sort: input.sort,
    filters: normalizeFilters(input.filters),
    isDefault: false,
  };
  return { ok: true, views: [...views, view], view };
}

export function renameView(views: SavedView[], userId: string, viewId: string, name: string): Ok<{ views: SavedView[]; view: SavedView }> | Err {
  const cleaned = cleanName(name);
  if (!cleaned.ok) return cleaned;
  const current = owned(views, userId, viewId);
  if (!current) return { ok: false, error: VIEW_ERRORS.missing };
  const taken = listViews(views, userId, current.projectId).some((view) => view.id !== viewId && viewNameKey(view.name) === cleaned.key);
  if (taken) return { ok: false, error: VIEW_ERRORS.duplicate };
  const view = { ...current, name: cleaned.value };
  return { ok: true, views: views.map((item) => (item.id === viewId ? view : item)), view };
}

export function deleteView(views: SavedView[], userId: string, viewId: string): Ok<{ views: SavedView[] }> | Err {
  const current = owned(views, userId, viewId);
  if (!current) return { ok: false, error: VIEW_ERRORS.missing };
  return { ok: true, views: views.filter((view) => view.id !== viewId) };
}

export function setDefaultView(
  views: SavedView[],
  userId: string,
  viewId: string,
  isDefault: boolean,
): Ok<{ views: SavedView[]; view: SavedView }> | Err {
  const current = owned(views, userId, viewId);
  if (!current) return { ok: false, error: VIEW_ERRORS.missing };
  const next = views.map((view) => {
    if (view.userId !== userId || view.projectId !== current.projectId) return view;
    if (view.id === viewId) return { ...view, isDefault };
    return isDefault ? { ...view, isDefault: false } : view;
  });
  const view = next.find((item) => item.id === viewId);
  if (!view) return { ok: false, error: VIEW_ERRORS.missing };
  return { ok: true, views: next, view };
}

function owned(views: SavedView[], userId: string, viewId: string) {
  return views.find((view) => view.id === viewId && view.userId === userId) ?? null;
}

function cleanName(name: string): { ok: true; value: string; key: string } | Err {
  const value = name.trim();
  if (!value) return { ok: false, error: VIEW_ERRORS.name };
  if (value.length > NAME_LIMIT) return { ok: false, error: VIEW_ERRORS.long };
  return { ok: true, value, key: viewNameKey(value) };
}

export function blankFilters(): IssueFilters {
  return emptyFilters();
}
