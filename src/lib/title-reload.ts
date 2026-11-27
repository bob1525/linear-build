import { sameVersion } from "@/lib/concurrency";

export type TitleReloadRequest = {
  id: number;
  serverUpdatedAt: string;
};

export type TitleReloadDecision =
  | { action: "idle" }
  | { action: "wait" }
  | { action: "apply"; id: number; title: string };

// A textarea remount can report the reloaded title joined to the title this
// page already had. That string is not an edit. Either order counts.
export function joinedReloadValue(
  value: string,
  parts: { to: string; from: string; shown: string },
): boolean {
  if (!value || value === parts.to) return false;
  const earlier = [parts.from, parts.shown].filter((part) => part.length > 0 && part !== parts.to);
  return earlier.some((part) => value === parts.to + part || value === part + parts.to);
}

export function titleAfterReload(
  issue: { title: string; updatedAt: string },
  request: TitleReloadRequest | null,
  appliedId: number,
): TitleReloadDecision {
  if (!request || request.id === appliedId) return { action: "idle" };
  if (!sameVersion(request.serverUpdatedAt, issue.updatedAt)) return { action: "wait" };
  return { action: "apply", id: request.id, title: issue.title };
}
