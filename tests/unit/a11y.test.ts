import { describe, expect, it } from "vitest";
import { passwordFieldForError, scrollTopForIndex, stepIndex } from "@/lib/a11y";

describe("window keyboard scroll", () => {
  const offsets = [0, 40, 80, 120, 160];

  it("leaves an item that is already inside the viewport", () => {
    expect(scrollTopForIndex(offsets, 1, 0, 100)).toBe(0);
  });

  it("scrolls up to the start of an item above the viewport", () => {
    expect(scrollTopForIndex(offsets, 0, 50, 100)).toBe(0);
  });

  it("scrolls down just enough to show an item below the viewport", () => {
    expect(scrollTopForIndex(offsets, 3, 0, 100)).toBe(60);
  });

  it("keeps the top of an item that is taller than the viewport", () => {
    expect(scrollTopForIndex([0, 200], 0, 40, 100)).toBe(0);
  });

  it("ignores an index outside the offset list", () => {
    expect(scrollTopForIndex(offsets, 9, 12, 100)).toBe(12);
  });
});

describe("stepIndex", () => {
  it("moves one row and stops at the ends", () => {
    expect(stepIndex(0, "ArrowDown", 10)).toBe(1);
    expect(stepIndex(9, "ArrowDown", 10)).toBe(9);
    expect(stepIndex(0, "ArrowUp", 10)).toBe(0);
    expect(stepIndex(4, "ArrowUp", 10)).toBe(3);
  });

  it("jumps to the first and last row", () => {
    expect(stepIndex(4, "Home", 10)).toBe(0);
    expect(stepIndex(4, "End", 10)).toBe(9);
  });

  it("does nothing for an empty list", () => {
    expect(stepIndex(0, "End", 0)).toBeNull();
    expect(stepIndex(0, "Enter", 4)).toBeNull();
  });
});

describe("passwordFieldForError", () => {
  it("focuses the field the message is about", () => {
    expect(passwordFieldForError("Passwords do not match")).toBe("confirm");
    expect(passwordFieldForError("Choose a different password")).toBe("new");
    expect(passwordFieldForError("Use at least 8 characters")).toBe("new");
    expect(passwordFieldForError("Password is too long")).toBe("new");
    expect(passwordFieldForError("Current password is incorrect")).toBe("current");
    expect(passwordFieldForError("Enter your current password")).toBe("current");
    expect(passwordFieldForError("Too many attempts. Try again in a few minutes.")).toBe("current");
  });
});
