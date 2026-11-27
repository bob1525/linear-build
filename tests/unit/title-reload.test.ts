import { describe, expect, it } from "vitest";
import { joinedReloadValue, titleAfterReload } from "@/lib/title-reload";

const loaded = "Conflict original";
const saved = "Conflict marcus";
const older = "2026-11-27T10:00:00.000Z";
const newer = "2026-11-27T10:05:00.000Z";

describe("joinedReloadValue", () => {
  const parts = { to: "Conflict marcus", from: "Conflict original", shown: "Conflict reload me" };

  it("recognizes the reloaded title joined to the loaded title or the draft", () => {
    expect(joinedReloadValue("Conflict marcusConflict original", parts)).toBe(true);
    expect(joinedReloadValue("Conflict originalConflict marcus", parts)).toBe(true);
    expect(joinedReloadValue("Conflict marcusConflict reload me", parts)).toBe(true);
    expect(joinedReloadValue("Conflict reload meConflict marcus", parts)).toBe(true);
  });

  it("leaves the reloaded title and a normal edit alone", () => {
    expect(joinedReloadValue("Conflict marcus", parts)).toBe(false);
    expect(joinedReloadValue("Conflict marcus!", parts)).toBe(false);
    expect(joinedReloadValue("", parts)).toBe(false);
  });
});

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
