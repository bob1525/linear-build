import { describe, expect, it } from "vitest";
import { LIST_ROW_ESTIMATE, LIST_VIRTUAL_MIN, listWindow } from "@/lib/list-window";

describe("listWindow", () => {
  it("mounts every row while the list is under the window minimum", () => {
    const layout = listWindow({ count: LIST_VIRTUAL_MIN - 1, scrollTop: 0, viewport: 120 });
    expect(layout.virtualized).toBe(false);
    expect(layout.indexes).toHaveLength(LIST_VIRTUAL_MIN - 1);
    expect(layout.indexes[0]).toBe(0);
    expect(layout.indexes.at(-1)).toBe(LIST_VIRTUAL_MIN - 2);
  });

  it("mounts a slice of a long list and leaves the last row out", () => {
    const layout = listWindow({ count: 40, scrollTop: 0, viewport: 200 });
    expect(layout.virtualized).toBe(true);
    expect(layout.total).toBe(40 * LIST_ROW_ESTIMATE);
    expect(layout.indexes.length).toBeLessThan(40);
    expect(layout.indexes).toContain(0);
    expect(layout.indexes).not.toContain(39);
  });

  it("includes the last row once the list is scrolled to the end and drops the first", () => {
    const top = listWindow({ count: 40, scrollTop: 0, viewport: 200 });
    const bottom = listWindow({ count: 40, scrollTop: top.total, viewport: 200 });
    expect(bottom.indexes).toContain(39);
    expect(bottom.indexes).not.toContain(0);
    expect(bottom.end).toBe(40);
    expect(bottom.indexes.length).toBeLessThan(40);
  });

  it("uses a measured row height when one is known", () => {
    const layout = listWindow({ count: 24, scrollTop: 0, viewport: 10_000, heights: [30] });
    expect(layout.virtualized).toBe(false);
    expect(layout.offsets[1]).toBe(30);
    expect(layout.total).toBe(30 + 23 * LIST_ROW_ESTIMATE);
  });
});
