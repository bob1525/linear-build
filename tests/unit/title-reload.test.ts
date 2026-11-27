import { describe, expect, it } from "vitest";
import { titleAfterReload } from "@/lib/title-reload";

const loaded = "Conflict original";
const saved = "Conflict marcus";
const older = "2026-11-27T10:00:00.000Z";
const newer = "2026-11-27T10:05:00.000Z";

describe("titleAfterReload", () => {
  it("does not write the loaded title while the page is still on the older version", () => {
    const decision = titleAfterReload({ title: loaded, updatedAt: older }, { id: 1, serverUpdatedAt: newer }, 0);
    expect(decision).toEqual({ action: "wait" });
  });

  it("applies only the title on the page once that page is the version that won", () => {
    const decision = titleAfterReload({ title: saved, updatedAt: newer }, { id: 1, serverUpdatedAt: newer }, 0);
    expect(decision).toEqual({ action: "apply", id: 1, title: saved });
    if (decision.action === "apply") expect(decision.title).not.toContain(loaded);
  });

  it("does not apply the same Reload twice", () => {
    const issue = { title: saved, updatedAt: newer };
    const request = { id: 1, serverUpdatedAt: newer };
    expect(titleAfterReload(issue, request, 1)).toEqual({ action: "idle" });
    expect(titleAfterReload(issue, null, 0)).toEqual({ action: "idle" });
  });
});
