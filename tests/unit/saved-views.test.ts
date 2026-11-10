import { describe, expect, it } from "vitest";
import { emptyFilters } from "@/lib/filters";
import {
  VIEW_ERRORS,
  createView,
  deleteView,
  listViews,
  renameView,
  setDefaultView,
  type SavedView,
} from "@/lib/saved-views";
import { hasExplicitViewQuery, parseSort, viewHref } from "@/lib/view-state";

const filters = { ...emptyFilters(), statuses: ["todo" as const], priorities: ["high" as const], query: "zephyr" };

function make(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "view-1",
    userId: "ava",
    projectId: "orbit",
    name: "Triage",
    viewType: "list",
    sort: "newest",
    filters,
    isDefault: false,
    ...overrides,
  };
}

function created(views: SavedView[], name: string, userId = "ava", projectId = "orbit", id = name) {
  const result = createView(views, {
    id,
    userId,
    projectId,
    name,
    viewType: "board",
    sort: "priority",
    filters: emptyFilters(),
  });
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("saved view crud", () => {
  it("creates a view with its filters, sort, and board or list type", () => {
    const before: SavedView[] = [];
    const result = createView(before, {
      id: "v1",
      userId: "ava",
      projectId: "orbit",
      name: "  Triage list  ",
      viewType: "list",
      sort: "newest",
      filters,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(before).toEqual([]);
    expect(result.view).toMatchObject({ name: "Triage list", viewType: "list", sort: "newest", filters });
    expect(listViews(result.views, "ava", "orbit").map((view) => view.name)).toEqual(["Triage list"]);
  });

  it("lists only the caller's views in that project", () => {
    const views = [make(), make({ id: "other-user", userId: "marcus", name: "Marcus" }), make({ id: "other-project", projectId: "pulse", name: "Pulse" })];
    expect(listViews(views, "ava", "orbit").map((view) => view.id)).toEqual(["view-1"]);
    expect(listViews(views, "marcus", "orbit").map((view) => view.name)).toEqual(["Marcus"]);
  });

  it("rejects an empty name, a long name, and a duplicate ignoring case", () => {
    const views = [make({ name: "Triage" })];
    expect(createView(views, { id: "x", userId: "ava", projectId: "orbit", name: "   ", viewType: "board", sort: "priority", filters: emptyFilters() })).toEqual({
      ok: false,
      error: VIEW_ERRORS.name,
    });
    expect(createView(views, { id: "x", userId: "ava", projectId: "orbit", name: "x".repeat(41), viewType: "board", sort: "priority", filters: emptyFilters() }).ok).toBe(false);
    const duplicate = createView(views, { id: "x", userId: "ava", projectId: "orbit", name: "triage", viewType: "board", sort: "priority", filters: emptyFilters() });
    expect(duplicate).toEqual({ ok: false, error: VIEW_ERRORS.duplicate });
    expect(views).toHaveLength(1);
  });

  it("allows the same name for another person and another project", () => {
    const views = [make({ name: "Bugs" })];
    expect(created(views, "Bugs", "marcus").view.userId).toBe("marcus");
    expect(created(views, "Bugs", "ava", "pulse").view.projectId).toBe("pulse");
  });

  it("renames a view and rejects a taken name", () => {
    const views = [make({ id: "a", name: "Alpha" }), make({ id: "b", name: "Beta" })];
    const renamed = renameView(views, "ava", "a", "Gamma");
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.view.name).toBe("Gamma");
    expect(views[0]?.name).toBe("Alpha");
    expect(renameView(renamed.views, "ava", "b", "gamma")).toEqual({ ok: false, error: VIEW_ERRORS.duplicate });
  });

  it("does not rename or delete someone else's view", () => {
    const views = [make()];
    expect(renameView(views, "marcus", "view-1", "Stolen")).toEqual({ ok: false, error: VIEW_ERRORS.missing });
    expect(deleteView(views, "marcus", "view-1")).toEqual({ ok: false, error: VIEW_ERRORS.missing });
    expect(views).toHaveLength(1);
  });

  it("deletes a view and reports a missing one", () => {
    const views = [make(), make({ id: "keep", name: "Keep" })];
    const result = deleteView(views, "ava", "view-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views.map((view) => view.id)).toEqual(["keep"]);
    expect(deleteView(result.views, "ava", "view-1")).toEqual({ ok: false, error: VIEW_ERRORS.missing });
  });

  it("keeps a single default per person and project", () => {
    const views = [
      make({ id: "a", name: "Alpha", isDefault: true }),
      make({ id: "b", name: "Beta" }),
      make({ id: "m", userId: "marcus", name: "Marcus", isDefault: true }),
      make({ id: "p", projectId: "pulse", name: "Pulse", isDefault: true }),
    ];
    const result = setDefaultView(views, "ava", "b", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views.find((view) => view.id === "a")?.isDefault).toBe(false);
    expect(result.views.find((view) => view.id === "b")?.isDefault).toBe(true);
    expect(result.views.find((view) => view.id === "m")?.isDefault).toBe(true);
    expect(result.views.find((view) => view.id === "p")?.isDefault).toBe(true);
    expect(views.find((view) => view.id === "a")?.isDefault).toBe(true);
  });

  it("clears a default without promoting another view", () => {
    const views = [make({ id: "a", isDefault: true }), make({ id: "b", name: "Beta" })];
    const result = setDefaultView(views, "ava", "a", false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views.every((view) => !view.isDefault)).toBe(true);
  });

  it("builds a list url that round-trips filters and sort", () => {
    const href = viewHref("ORB", "list", filters, "newest", "view-1");
    expect(href.startsWith("/p/ORB/list?")).toBe(true);
    expect(href).toContain("status=todo");
    expect(href).toContain("priority=high");
    expect(href).toContain("q=zephyr");
    expect(href).toContain("sort=newest");
    expect(href).toContain("view=view-1");
    expect(viewHref("ORB", "board", emptyFilters(), "priority")).toBe("/p/ORB");
    expect(parseSort("nope")).toBe("priority");
    expect(hasExplicitViewQuery({})).toBe(false);
    expect(hasExplicitViewQuery({ all: "1" })).toBe(true);
    expect(hasExplicitViewQuery({ q: "  " })).toBe(false);
  });
});
