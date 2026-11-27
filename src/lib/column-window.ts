/** Cards kept fully mounted. Relay's long backlog is 12, so 10 is the first column that windows. */
export const COLUMN_VIRTUAL_MIN = 10;
/** Tall estimate so an unmeasured card still occupies enough scroll range to be reached. */
export const COLUMN_CARD_ESTIMATE = 160;
/** Tailwind `gap-2` between cards. The virtual list applies this itself. */
export const COLUMN_CARD_GAP = 8;
export const COLUMN_OVERSCAN = 2;

export type ColumnWindow = {
  start: number;
  end: number;
  total: number;
  offsets: number[];
  indexes: number[];
  virtualized: boolean;
};

export function columnWindow({
  count,
  scrollTop,
  viewport,
  gap = COLUMN_CARD_GAP,
  estimate = COLUMN_CARD_ESTIMATE,
  overscan = COLUMN_OVERSCAN,
  heights,
  pinIndexes = [],
  minimum = COLUMN_VIRTUAL_MIN,
}: {
  count: number;
  scrollTop: number;
  viewport: number;
  gap?: number;
  estimate?: number;
  overscan?: number;
  heights?: Array<number | undefined>;
  pinIndexes?: number[];
  /** Lists pass their own floor. Columns keep the default of 10. */
  minimum?: number;
}): ColumnWindow {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let index = 0; index < count; index += 1) {
    const measured = heights?.[index];
    const height = measured !== undefined && measured > 0 ? measured : estimate;
    const trailing = index === count - 1 ? 0 : gap;
    offsets[index + 1] = offsets[index]! + height + trailing;
  }
  const total = offsets[count] ?? 0;
  const every = Array.from({ length: count }, (_, index) => index);
  if (count === 0 || count < minimum) {
    return { start: 0, end: count, total, offsets, indexes: every, virtualized: false };
  }
  const view = viewport > 0 ? viewport : estimate * (overscan + 6);
  if (viewport > 0 && total <= view) {
    return { start: 0, end: count, total, offsets, indexes: every, virtualized: false };
  }
  const top = Math.max(0, scrollTop);
  const bottom = top + view;
  let start = 0;
  while (start < count && offsets[start + 1]! <= top) start += 1;
  let end = start;
  while (end < count && offsets[end]! < bottom) end += 1;
  start = Math.max(0, start - overscan);
  end = Math.min(count, end + overscan);
  const chosen = new Set<number>();
  for (let index = start; index < end; index += 1) chosen.add(index);
  for (const index of pinIndexes) {
    if (index >= 0 && index < count) chosen.add(index);
  }
  const indexes = [...chosen].sort((left, right) => left - right);
  return {
    start,
    end,
    total,
    offsets,
    indexes,
    virtualized: indexes.length < count,
  };
}
