import { describe, expect, it } from "vitest";
import { columnWindow } from "@/lib/column-window";

describe("columnWindow", () => {
  it("mounts every card when the column is shorter than the window minimum", () => {
    const layout = columnWindow({ count: 9, scrollTop: 0, viewport: 100, estimate: 100, gap: 0, overscan: 0 });
    expect(layout.virtualized).toBe(false);
    expect(layout.indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("mounts the visible slice of a long column and keeps the rest out", () => {
    const layout = columnWindow({ count: 10, scrollTop: 0, viewport: 250, estimate: 100, gap: 0, overscan: 0 });
    expect(layout.virtualized).toBe(true);
    expect(layout.indexes).toEqual([0, 1, 2]);
    expect(layout.total).toBe(1000);
    expect(layout.indexes).not.toContain(9);
  });

  it("includes the last card once the column is scrolled to the end", () => {
    const layout = columnWindow({ count: 10, scrollTop: 800, viewport: 250, estimate: 100, gap: 0, overscan: 0 });
    expect(layout.indexes[0]).toBeGreaterThan(0);
    expect(layout.indexes).toContain(9);
    expect(layout.end).toBe(10);
  });

  it("keeps a pinned card mounted when it sits outside the visible slice", () => {
    const layout = columnWindow({
      count: 10,
      scrollTop: 800,
      viewport: 250,
      estimate: 100,
      gap: 0,
      overscan: 0,
      pinIndexes: [0, 99],
    });
    expect(layout.indexes).toContain(0);
    expect(layout.indexes).toContain(9);
    expect(layout.indexes).not.toContain(99);
    expect(layout.indexes).toEqual([...layout.indexes].sort((left, right) => left - right));
  });

  it("uses a measured height and the gap between cards", () => {
    const estimated = columnWindow({ count: 3, scrollTop: 0, viewport: 1000, estimate: 100, gap: 8 });
    const measured = columnWindow({
      count: 3,
      scrollTop: 0,
      viewport: 1000,
      estimate: 100,
      gap: 8,
      heights: [40, 80, undefined],
    });
    expect(estimated.total).toBe(100 + 8 + 100 + 8 + 100);
    expect(measured.total).toBe(40 + 8 + 80 + 8 + 100);
    expect(measured.offsets[1]).toBe(48);
    expect(measured.offsets[2]).toBe(136);
  });

  it("windows a 12-card column in a short viewport and a 125-card column at both ends", () => {
    const relay = columnWindow({ count: 12, scrollTop: 0, viewport: 480, estimate: 120, gap: 8, overscan: 2 });
    expect(relay.virtualized).toBe(true);
    expect(relay.indexes.length).toBeLessThan(12);
    expect(relay.indexes).toContain(0);
    expect(relay.indexes).not.toContain(11);

    const top = columnWindow({ count: 125, scrollTop: 0, viewport: 520, estimate: 120, gap: 8, overscan: 2 });
    const bottom = columnWindow({
      count: 125,
      scrollTop: top.total,
      viewport: 520,
      estimate: 120,
      gap: 8,
      overscan: 2,
    });
    expect(top.indexes.length).toBeLessThan(30);
    expect(top.indexes).not.toContain(124);
    expect(bottom.indexes).toContain(124);
    expect(bottom.indexes).not.toContain(0);
  });

  it("still slices a long column before the viewport has been measured", () => {
    const layout = columnWindow({ count: 125, scrollTop: 0, viewport: 0, estimate: 160, gap: 8, overscan: 2 });
    expect(layout.virtualized).toBe(true);
    expect(layout.indexes.length).toBeLessThan(40);
  });

  it("treats a negative scroll offset as the top of the column", () => {
    const layout = columnWindow({ count: 20, scrollTop: -40, viewport: 200, estimate: 100, gap: 0, overscan: 0 });
    expect(layout.indexes[0]).toBe(0);
  });
});
