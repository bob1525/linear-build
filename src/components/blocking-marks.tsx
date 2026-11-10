import type { IssueDTO } from "@/lib/types";

export function BlockingMarks({ issue }: { issue: Pick<IssueDTO, "blocksCount" | "blockedByCount"> }) {
  if (issue.blocksCount === 0 && issue.blockedByCount === 0) return null;
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1">
      {issue.blockedByCount > 0 ? (
        <span data-blocked="true" className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
          Blocked
        </span>
      ) : null}
      {issue.blocksCount > 0 ? (
        <span data-blocks="true" className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Blocks
        </span>
      ) : null}
    </span>
  );
}
