import { describe, expect, it } from "vitest";
import { describeActivity, formatActivityLine } from "@/lib/activity";

describe("describeActivity", () => {
  it("describes status, priority, assignee, and comment events", () => {
    expect(describeActivity("created", {})).toBe("created the issue");
    expect(describeActivity("commented", "{}")).toBe("commented");
    expect(describeActivity("status_changed", { from: "todo", to: "in_progress" })).toBe(
      "changed status from Todo to In Progress",
    );
    expect(describeActivity("priority_changed", JSON.stringify({ to: "urgent" }))).toBe("set priority to Urgent");
    expect(describeActivity("assignee_changed", { toName: "Ava Chen" })).toBe("assigned Ava Chen");
    expect(describeActivity("assignee_changed", { toName: null })).toBe("cleared the assignee");
  });

  it("describes due dates and label edits", () => {
    expect(describeActivity("due_date_changed", { to: "2026-05-02T12:00:00.000Z" })).toContain("May 2");
    expect(describeActivity("due_date_changed", { to: null })).toBe("cleared the due date");
    expect(describeActivity("labels_changed", { added: ["Bug"], removed: [] })).toBe("added Bug");
    expect(describeActivity("labels_changed", { added: [], removed: ["Design"] })).toBe("removed Design");
    expect(describeActivity("labels_changed", { added: ["Bug"], removed: ["Design"] })).toBe("updated labels");
  });

  it("describes relations and sub-issues", () => {
    expect(describeActivity("relation_added", { role: "blocked_by", key: "ORB-3" })).toBe("marked this issue as blocked by ORB-3");
    expect(describeActivity("relation_added", { role: "blocks", key: "ORB-2" })).toBe("marked this issue as blocking ORB-2");
    expect(describeActivity("relation_removed", { role: "related", key: "ORB-5" })).toBe("removed the relation to ORB-5");
    expect(describeActivity("subissue_added", { role: "child", key: "ORB-5" })).toBe("added ORB-5 as a sub-issue");
    expect(describeActivity("subissue_removed", { role: "parent", key: "ORB-1" })).toBe("cleared the parent ORB-1");
  });

  it("falls back when the payload is invalid or the type is unknown", () => {
    expect(describeActivity("title_changed", "{")).toBe("renamed the issue");
    expect(describeActivity("description_changed", null)).toBe("updated the description");
    expect(describeActivity("mystery", { hello: "there" })).toBe("updated the issue");
    expect(formatActivityLine("Marcus Hale", "commented", {})).toBe("Marcus Hale commented");
  });
});
