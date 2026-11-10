import type { ReactNode } from "react";
import Link from "next/link";
import { toSearchParams, type IssueFilters } from "@/lib/filters";
import type { LabelDTO, ProjectSummary, UserDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { FilterBar } from "@/components/filter-bar";
import { BoardIcon, ListIcon } from "@/components/icons";
import { NewIssueButton } from "@/components/shell-context";

export function ViewHeader({
  project,
  view,
  shown,
  total,
  filters,
  members,
  labels,
}: {
  project: ProjectSummary;
  view: "board" | "list";
  shown: number;
  total: number;
  filters: IssueFilters;
  members: UserDTO[];
  labels: LabelDTO[];
}) {
  const query = toSearchParams(filters).toString();
  const suffix = query ? `?${query}` : "";
  return (
    <header className="relative border-b border-line px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">{project.name}</h1>
            <p className="truncate text-[12px] text-ink-faint">{project.description}</p>
          </div>
          <div className="inline-flex rounded-md border border-line p-0.5" aria-label="Views">
            <ViewLink href={`/p/${project.key}${suffix}`} active={view === "board"} label="Board" icon={<BoardIcon />} />
            <ViewLink href={`/p/${project.key}/list${suffix}`} active={view === "list"} label="List" icon={<ListIcon />} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[12px] tabular-nums text-ink-muted">{shown === total ? `${total} issues` : `${shown} of ${total}`}</p>
          <NewIssueButton />
        </div>
      </div>
      <div className="mt-3">
        <FilterBar filters={filters} members={members} labels={labels} />
      </div>
    </header>
  );
}

function ViewLink({ href, active, label, icon }: { href: string; active: boolean; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded px-2 text-[12px]",
        active ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
