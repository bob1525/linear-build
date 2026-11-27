import { describe, expect, it } from "vitest";
import { columnUnderPointer, type ColumnRect } from "@/lib/kanban-collision";

const columns: { id: string; rect: ColumnRect }[] = [
  { id: "backlog", rect: { left: 264, top: 122, width: 241, height: 582 } },
  { id: "todo", rect: { left: 517, top: 122, width: 241, height: 582 } },
  { id: "in_progress", rect: { left: 770, top: 122, width: 241, height: 582 } },
  { id: "done", rect: { left: 1023, top: 122, width: 241, height: 582 } },
];

describe("columnUnderPointer", () => {
  it("chooses the column that contains the pointer when the card would straddle the next column", () => {
    expect(columnUnderPointer({ x: 903, y: 384 }, columns)).toBe("in_progress");
    expect(columnUnderPointer({ x: 990, y: 560 }, columns)).toBe("in_progress");
  });

  it("chooses a short or empty column when the pointer is in its lower empty area", () => {
    expect(columnUnderPointer({ x: 890, y: 640 }, columns)).toBe("in_progress");
  });

  it("uses the nearest column when the pointer is in the gap", () => {
    expect(columnUnderPointer({ x: 1017, y: 400 }, columns)).toBe("in_progress");
    expect(columnUnderPointer({ x: 1018, y: 400 }, columns)).toBe("done");
  });

  it("uses scrolled column boxes, including ones that start off the left edge", () => {
    const scrolled = [
      { id: "backlog", rect: { left: -392, top: 122, width: 300, height: 500 } },
      { id: "todo", rect: { left: -80, top: 122, width: 300, height: 500 } },
      { id: "in_progress", rect: { left: 232, top: 122, width: 300, height: 500 } },
      { id: "done", rect: { left: 544, top: 122, width: 300, height: 500 } },
    ];
    expect(columnUnderPointer({ x: 680, y: 360 }, scrolled)).toBe("done");
    expect(columnUnderPointer({ x: 300, y: 360 }, scrolled)).toBe("in_progress");
    expect(columnUnderPointer({ x: -100, y: 200 }, scrolled)).toBe("backlog");
  });

  it("returns null when the pointer is outside every column", () => {
    expect(columnUnderPointer({ x: 400, y: 20 }, columns)).toBeNull();
  });
});
