import { STATUSES, statusLabel, type Status } from "@/lib/constants";

export type KeyModifiers = {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

/** Alt+Left or Alt+Right, with no other modifier. Plain arrows stay focus movement. */
export function columnMoveDirection(event: KeyModifiers): -1 | 1 | null {
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return null;
  if (event.key === "ArrowLeft") return -1;
  if (event.key === "ArrowRight") return 1;
  return null;
}

/** The neighboring status, or null at either end of the board. */
export function adjacentStatus(status: Status, direction: -1 | 1): Status | null {
  const index = STATUSES.findIndex((item) => item.id === status);
  if (index < 0) return null;
  return STATUSES[index + direction]?.id ?? null;
}

export function columnEdgeNote(status: Status, direction: -1 | 1): string {
  const label = statusLabel(status);
  return direction < 0 ? `${label} is the first column` : `${label} is the last column`;
}
