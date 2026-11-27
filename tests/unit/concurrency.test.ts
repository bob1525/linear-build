import { describe, expect, it } from "vitest";
import { CONFLICT_ERROR, conflictCopy, sameVersion, shouldRejectStaleWrite } from "@/lib/concurrency";
import { updateIssueSchema } from "@/lib/validators";

const current = "2026-04-02T15:04:05.123Z";

describe("concurrent edits", () => {
  it("treats the same instant as the loaded version", () => {
    expect(sameVersion(current, current)).toBe(true);
    expect(sameVersion(current, new Date(current))).toBe(true);
    expect(shouldRejectStaleWrite({ baseUpdatedAt: current, currentUpdatedAt: current })).toBe(false);
  });

  it("rejects a later save that still has the older version", () => {
    const newer = "2026-04-02T15:09:05.123Z";
    expect(shouldRejectStaleWrite({ baseUpdatedAt: current, currentUpdatedAt: newer })).toBe(true);
    expect(shouldRejectStaleWrite({ baseUpdatedAt: "not-a-date", currentUpdatedAt: newer })).toBe(true);
  });

  it("lets an explicit overwrite through and ignores saves that did not send a version", () => {
    const newer = "2026-04-02T15:09:05.123Z";
    expect(shouldRejectStaleWrite({ baseUpdatedAt: current, currentUpdatedAt: newer, overwrite: true })).toBe(false);
    expect(shouldRejectStaleWrite({ currentUpdatedAt: newer })).toBe(false);
    expect(shouldRejectStaleWrite({ baseUpdatedAt: null, currentUpdatedAt: newer })).toBe(false);
  });

  it("names the other person in the prompt and falls back when they are unknown", () => {
    expect(conflictCopy("Marcus Hale")).toContain("Marcus Hale saved this issue");
    expect(conflictCopy("Marcus Hale")).toContain("Reload");
    expect(conflictCopy("Marcus Hale")).toContain("overwrite");
    expect(CONFLICT_ERROR).toBe(conflictCopy(null));
    expect(CONFLICT_ERROR.startsWith("Someone else saved this issue")).toBe(true);
  });

  it("accepts a version and an overwrite flag, and still rejects a title that is too long", () => {
    const parsed = updateIssueSchema.parse({
      issueId: "issue_1",
      title: "Renamed",
      baseUpdatedAt: current,
      overwrite: true,
    });
    expect(parsed.baseUpdatedAt).toBe(current);
    expect(parsed.overwrite).toBe(true);
    const longTitle = updateIssueSchema.safeParse({ issueId: "issue_1", title: "x".repeat(201) });
    expect(longTitle.success).toBe(false);
  });
});
