import { describe, expect, it } from "vitest";
import { colorFromName, formatDueDate, formatIssueKey, formatRelativeTime, isOverdue, parseDueDateInput, toDateInputValue } from "@/lib/format";
import { compareIssues, groupByStatus } from "@/lib/issue-view";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("issue ordering", () => {
  it("sorts by priority and then by number, and groups every status", () => {
    const issues = [
      { id: "a", status: "todo" as const, priority: "low", number: 2 },
      { id: "b", status: "todo" as const, priority: "urgent", number: 9 },
      { id: "c", status: "done" as const, priority: "high", number: 4 },
      { id: "d", status: "todo" as const, priority: "urgent", number: 3 },
    ];
    expect(compareIssues(issues[0]!, issues[1]!)).toBeGreaterThan(0);
    const groups = groupByStatus(issues);
    expect(groups.todo.map((issue) => issue.id)).toEqual(["d", "b", "a"]);
    expect(groups.done.map((issue) => issue.id)).toEqual(["c"]);
    expect(groups.backlog).toEqual([]);
    expect(groups.in_progress).toEqual([]);
  });
});

describe("dates and identity helpers", () => {
  const now = new Date("2026-11-10T15:00:00.000Z");

  it("formats issue keys and due dates in UTC", () => {
    expect(formatIssueKey("orb", 12)).toBe("ORB-12");
    expect(formatDueDate("2026-05-02T12:00:00.000Z", now)).toBe("May 2");
    expect(formatDueDate("2025-05-02T12:00:00.000Z", now)).toBe("May 2, 2025");
  });

  it("rejects impossible calendar days and round-trips valid ones", () => {
    expect(parseDueDateInput("2026-02-31")).toBeNull();
    expect(parseDueDateInput("05-02-2026")).toBeNull();
    const parsed = parseDueDateInput("2026-05-02");
    expect(parsed?.toISOString()).toBe("2026-05-02T12:00:00.000Z");
    expect(toDateInputValue(parsed?.toISOString() ?? null)).toBe("2026-05-02");
  });

  it("marks open issues overdue only after the due day", () => {
    expect(isOverdue("2026-11-09T12:00:00.000Z", "todo", now)).toBe(true);
    expect(isOverdue("2026-11-10T12:00:00.000Z", "todo", now)).toBe(false);
    expect(isOverdue("2026-11-01T12:00:00.000Z", "done", now)).toBe(false);
    expect(isOverdue(null, "todo", now)).toBe(false);
  });

  it("formats recent times relative to a fixed clock", () => {
    expect(formatRelativeTime("2026-11-10T15:00:10.000Z", now.getTime())).toBe("just now");
    expect(formatRelativeTime("2026-11-10T13:00:00.000Z", now.getTime())).toBe("2 hours ago");
    expect(formatRelativeTime("2026-11-08T15:00:00.000Z", now.getTime())).toBe("2 days ago");
  });

  it("keeps avatar colors stable", () => {
    expect(colorFromName("Ava Chen")).toBe(colorFromName("Ava Chen"));
    expect(colorFromName("Ava Chen")).toMatch(/^#/);
  });
});

describe("passwords", () => {
  it("verifies a matching password and rejects a different one", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword("demo1234", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
