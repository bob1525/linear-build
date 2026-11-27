import { describe, expect, it } from "vitest";
import { blockedReloadValue, pageCaughtReload, titleAfterReload } from "@/lib/title-reload";

const loaded = "Conflict original";
const saved = "Conflict marcus";
const older = "2026-11-27T10:00:00.000Z";
const newer = "2026-11-27T10:05:00.000Z";

describe("blockedReloadValue", () => {
  const parts = { to: "Conflict marcus", from: "Conflict original", shown: "Conflict reload me" };

  it("recognizes the draft, the loaded title, and either joined order", () => {
    expect(blockedReloadValue("Conflict reload me", parts)).toBe(true);
    expect(blockedReloadValue("Conflict original", parts)).toBe(true);
    expect(blockedReloadValue("Conflict marcusConflict original", parts)).toBe(true);
    expect(blockedReloadValue("Conflict originalConflict marcus", parts)).toBe(true);
    expect(blockedReloadValue("Conflict marcusConflict reload me", parts)).toBe(true);
    expect(blockedReloadValue("Conflict reload meConflict marcus", parts)).toBe(true);
  });

  it("leaves the reloaded title and a normal edit alone", () => {
    expect(blockedReloadValue("Conflict marcus", parts)).toBe(false);
    expect(blockedReloadValue("Conflict marcus!", parts)).toBe(false);
    expect(blockedReloadValue("", parts)).toBe(false);
  });
});

describe("titleAfterReload", () => {
  const request = { id: 1, serverUpdatedAt: newer, title: saved };

  it("applies the conflict title while the page still has the older title", () => {
    const decision = titleAfterReload({ title: loaded, updatedAt: older }, request, 0);
    expect(decision).toEqual({ action: "apply", id: 1, title: saved });
    if (decision.action === "apply") expect(decision.title).not.toContain(loaded);
  });

  it("does not replace that title with the loaded page title", () => {
    const decision = titleAfterReload({ title: loaded, updatedAt: newer }, request, 0);
    expect(decision).toEqual({ action: "apply", id: 1, title: saved });
  });

  it("does not apply the same Reload twice", () => {
    const issue = { title: saved, updatedAt: newer };
    expect(titleAfterReload(issue, request, 1)).toEqual({ action: "idle" });
    expect(titleAfterReload(issue, null, 0)).toEqual({ action: "idle" });
    expect(titleAfterReload(issue, { ...request, title: "  " }, 0)).toEqual({ action: "wait" });
  });

  it("holds a page that has not reached the reloaded version", () => {
    expect(pageCaughtReload({ updatedAt: older }, request, 1)).toBe(false);
    expect(pageCaughtReload({ updatedAt: newer }, request, 1)).toBe(true);
    expect(pageCaughtReload({ updatedAt: older }, request, 0)).toBe(true);
  });
});
