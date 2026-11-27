import { pointerWithin, type CollisionDetection } from "@dnd-kit/core";

export type ColumnRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
};

function rightEdge(rect: ColumnRect) {
  return rect.right ?? rect.left + rect.width;
}

function bottomEdge(rect: ColumnRect) {
  return rect.bottom ?? rect.top + rect.height;
}

function contains(rect: ColumnRect, pointer: { x: number; y: number }) {
  return pointer.x >= rect.left && pointer.x <= rightEdge(rect) && pointer.y >= rect.top && pointer.y <= bottomEdge(rect);
}

function closestCenterX(pointerX: number, columns: { id: string; rect: ColumnRect }[]) {
  return columns.reduce((best, column) => {
    const center = column.rect.left + column.rect.width / 2;
    const bestCenter = best.rect.left + best.rect.width / 2;
    return Math.abs(pointerX - center) < Math.abs(pointerX - bestCenter) ? column : best;
  }).id;
}

/**
 * Column under the pointer. A card is wider than the gap between columns, so
 * rectangle-vs-rectangle scoring (closestCorners) can prefer the neighbor even
 * when the pointer is inside the intended column. Gaps use the nearest center.
 */
export function columnUnderPointer(
  pointer: { x: number; y: number },
  columns: { id: string; rect: ColumnRect }[],
): string | null {
  const inside = columns.filter((column) => contains(column.rect, pointer));
  if (inside.length === 1) return inside[0]!.id;
  const pool =
    inside.length > 1
      ? inside
      : columns.filter((column) => pointer.y >= column.rect.top && pointer.y <= bottomEdge(column.rect));
  if (pool.length === 0) return null;
  return closestCenterX(pointer.x, pool);
}

export const kanbanCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  if (!args.pointerCoordinates) return [];

  const columns = [];
  for (const container of args.droppableContainers) {
    const rect = args.droppableRects.get(container.id);
    if (!rect) continue;
    columns.push({ id: String(container.id), rect });
  }
  const id = columnUnderPointer(args.pointerCoordinates, columns);
  return id ? [{ id }] : [];
};
