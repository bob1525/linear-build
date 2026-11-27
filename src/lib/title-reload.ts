import { sameVersion } from "@/lib/concurrency";

export type TitleReloadRequest = {
  id: number;
  serverUpdatedAt: string;
  title: string;
};

export type TitleReloadDecision =
  | { action: "idle" }
  | { action: "wait" }
  | { action: "apply"; id: number; title: string };

// A textarea remount can report the reloaded title joined to the title this
// page already had, or it can report the draft again. Neither string is an edit.
export function blockedReloadValue(
  value: string,
  parts: { to: string; from: string; shown: string },
): boolean {
  if (!value || value === parts.to) return false;
  if (value === parts.from || value === parts.shown) return true;
  const earlier = [parts.from, parts.shown].filter((part) => part.length > 0 && part !== parts.to);
  return earlier.some((part) => value === parts.to + part || value === part + parts.to);
}

export function titleAfterReload(
  _issue: { title: string; updatedAt: string },
  request: TitleReloadRequest | null,
  appliedId: number,
): TitleReloadDecision {
  if (!request || request.id === appliedId) return { action: "idle" };
  if (!request.title.trim()) return { action: "wait" };
  // The page can still be showing the title from before the other save.
  // The conflict response carries the title that won, so Reload does not wait
  // for a refresh that may not commit.
  return { action: "apply", id: request.id, title: request.title };
}

export function pageCaughtReload(
  issue: { updatedAt: string },
  request: TitleReloadRequest | null,
  appliedId: number,
): boolean {
  if (!request || request.id !== appliedId) return true;
  return sameVersion(request.serverUpdatedAt, issue.updatedAt);
}
