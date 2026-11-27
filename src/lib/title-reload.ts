import { sameVersion } from "@/lib/concurrency";

export type TitleReloadRequest = {
  id: number;
  serverUpdatedAt: string;
};

export type TitleReloadDecision =
  | { action: "idle" }
  | { action: "wait" }
  | { action: "apply"; id: number; title: string };

export function titleAfterReload(
  issue: { title: string; updatedAt: string },
  request: TitleReloadRequest | null,
  appliedId: number,
): TitleReloadDecision {
  if (!request || request.id === appliedId) return { action: "idle" };
  if (!sameVersion(request.serverUpdatedAt, issue.updatedAt)) return { action: "wait" };
  return { action: "apply", id: request.id, title: issue.title };
}
