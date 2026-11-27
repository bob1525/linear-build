import { columnWindow, type ColumnWindow } from "@/lib/column-window";

/**
 * Seeded projects stay fully mounted: Orbit 20, Relay 21, Pulse 14, Atlas 12.
 * The 500-issue measurement list, and any filtered list of 24 or more, windows.
 */
export const LIST_VIRTUAL_MIN = 24;
/** Taller than a one-line row, so the scrollbar can reach the last row before it is measured. */
export const LIST_ROW_ESTIMATE = 48;
/** Rows are separated by a border, not a gap. */
export const LIST_ROW_GAP = 0;
export const LIST_OVERSCAN = 4;

export function listWindow({
  count,
  scrollTop,
  viewport,
  heights,
  pinIndexes,
}: {
  count: number;
  scrollTop: number;
  viewport: number;
  heights?: Array<number | undefined>;
  pinIndexes?: number[];
}): ColumnWindow {
  return columnWindow({
    count,
    scrollTop,
    viewport,
    gap: LIST_ROW_GAP,
    estimate: LIST_ROW_ESTIMATE,
    overscan: LIST_OVERSCAN,
    heights,
    pinIndexes,
    minimum: LIST_VIRTUAL_MIN,
  });
}
