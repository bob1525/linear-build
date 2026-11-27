import { describe, expect, it } from "vitest";
import { adjacentStatus, columnEdgeNote, columnMoveDirection } from "@/lib/keyboard-move";

const plain = { altKey: false, metaKey: false, ctrlKey: false, shiftKey: false };

describe("columnMoveDirection", () => {
  it("uses alt with a horizontal arrow", () => {
    expect(columnMoveDirection({ ...plain, altKey: true, key: "ArrowRight" })).toBe(1);
    expect(columnMoveDirection({ ...plain, altKey: true, key: "ArrowLeft" })).toBe(-1);
  });

  it("leaves plain arrows, vertical arrows, and extra modifiers alone", () => {
    expect(columnMoveDirection({ ...plain, key: "ArrowRight" })).toBeNull();
    expect(columnMoveDirection({ ...plain, key: "ArrowLeft" })).toBeNull();
    expect(columnMoveDirection({ ...plain, altKey: true, key: "ArrowUp" })).toBeNull();
    expect(columnMoveDirection({ ...plain, altKey: true, key: "ArrowDown" })).toBeNull();
    expect(columnMoveDirection({ ...plain, altKey: true, shiftKey: true, key: "ArrowRight" })).toBeNull();
    expect(columnMoveDirection({ ...plain, altKey: true, ctrlKey: true, key: "ArrowRight" })).toBeNull();
    expect(columnMoveDirection({ ...plain, altKey: true, metaKey: true, key: "ArrowLeft" })).toBeNull();
  });
});

describe("adjacentStatus", () => {
  it("steps across the four columns and stops at the ends", () => {
    expect(adjacentStatus("backlog", 1)).toBe("todo");
    expect(adjacentStatus("todo", -1)).toBe("backlog");
    expect(adjacentStatus("todo", 1)).toBe("in_progress");
    expect(adjacentStatus("in_progress", 1)).toBe("done");
    expect(adjacentStatus("backlog", -1)).toBeNull();
    expect(adjacentStatus("done", 1)).toBeNull();
  });

  it("names the end the card cannot pass", () => {
    expect(columnEdgeNote("backlog", -1)).toBe("Backlog is the first column");
    expect(columnEdgeNote("done", 1)).toBe("Done is the last column");
  });
});
