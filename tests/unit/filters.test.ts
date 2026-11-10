import { describe, expect, it } from "vitest";
import { UNASSIGNED } from "@/lib/constants";
import {
  emptyFilters,
  hasActiveFilters,
  issueMatchesFilters,
  parseFilters,
  toSearchParams,
  type FilterableIssue,
  type IssueFilters,
} from "@/lib/filters";

const issue: FilterableIssue = {
  title: "Zephyr cache returns stale issue counts",
  description: "Search for zephyr-cache in the header.",
  key: "ORB-3",
  status: "todo",
  priority: "high",
  assigneeId: "priya",
  labelIds: ["bug", "perf"],
};

describe("parseFilters", () => {
  it("reads combinable filters and ignores unknown workflow values", () => {
    const filters = parseFilters({
      status: "todo,nope,in_progress,todo",
      priority: ["high", "urgent"],
      assignee: "priya,unassigned",
      label: "bug",
      q: "  zephyr  ",
    });
    expect(filters.statuses).toEqual(["todo", "in_progress"]);
    expect(filters.priorities).toEqual(["high", "urgent"]);
    expect(filters.assignees).toEqual(["priya", "unassigned"]);
    expect(filters.labels).toEqual(["bug"]);
    expect(filters.query).toBe("zephyr");
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns an empty filter set when the query is blank", () => {
    const filters = parseFilters({ q: "   " });
    expect(filters).toEqual(emptyFilters());
    expect(hasActiveFilters(filters)).toBe(false);
    expect(toSearchParams(filters).toString()).toBe("");
  });

  it("round-trips active filters into a query string", () => {
    const filters = parseFilters({ status: "done", priority: "low", q: "orb-3" });
    const params = toSearchParams(filters);
    expect(params.get("status")).toBe("done");
    expect(params.get("priority")).toBe("low");
    expect(params.get("q")).toBe("orb-3");
  });
});

describe("issueMatchesFilters", () => {
  it("requires every facet to match and treats values inside a facet as OR", () => {
    expect(issueMatchesFilters(issue, { ...emptyFilters(), statuses: ["todo", "done"], priorities: ["high"] })).toBe(true);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), statuses: ["done"], priorities: ["high"] })).toBe(false);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), priorities: ["low", "medium"] })).toBe(false);
  });

  it("matches unassigned issues and any selected label", () => {
    const unassigned = { ...issue, assigneeId: null, labelIds: ["feature"] };
    expect(issueMatchesFilters(unassigned, { ...emptyFilters(), assignees: [UNASSIGNED] })).toBe(true);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), assignees: [UNASSIGNED] })).toBe(false);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), labels: ["docs", "perf"] })).toBe(true);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), labels: ["docs"] })).toBe(false);
  });

  it("searches the key, title, and description without case sensitivity", () => {
    expect(issueMatchesFilters(issue, { ...emptyFilters(), query: "ORB-3" })).toBe(true);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), query: "ZEPHYR-cache" })).toBe(true);
    expect(issueMatchesFilters(issue, { ...emptyFilters(), query: "missing" })).toBe(false);
  });

  it("combines keyword search with the other facets", () => {
    const filters: IssueFilters = { ...emptyFilters(), statuses: ["todo"], priorities: ["high"], query: "zephyr" };
    expect(issueMatchesFilters(issue, filters)).toBe(true);
    expect(issueMatchesFilters({ ...issue, status: "done" }, filters)).toBe(false);
  });
});
