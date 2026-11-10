import type { ReactNode } from "react";
import Link from "next/link";
import { toSearchParams, type IssueFilters } from "@/lib/filters";
import type { LabelDTO, ProjectSummary, SavedViewDTO, UserDTO } from "@/lib/types";
import { type IssueSort, type ViewType } from "@/lib/view-state";
import { cn } from "@/lib/cn";
import { FilterBar } from "@/components/filter-bar";
import { SavedViews } from "@/components/saved-views";
import { BoardIcon, ListIcon } from "@/components/icons";
import { NewIssueButton } from "@/components/shell-context";

export function ViewHeader({
  project,
  view,
  shown,
  total,
  filters,
  sort,
  showAll,
  members,
  labels,
  views,
  activeViewId,
}: {
  project: ProjectSummary;
  view: ViewType;
  shown: number;
  total: number;
  filters: IssueFilters;
  sort: IssueSort;
  showAll: boolean;
  members: UserDTO[];
  labels: LabelDTO[];
  views: SavedViewDTO[];
  activeViewId: string | null;
}) {
  const params = toSearchParams(filters);
  if (sort !== "priority") params.set("sort", sort);
  if (showAll) params.set("all", "1");
  const suffix = params.toString() ? `?${params.toString()}` : "";
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
        <FilterBar
          filters={filters}
          sort={sort}
          showAll={showAll}
          members={members}
          labels={labels}
          trailing={
            <SavedViews
              projectKey={project.key}
              viewType={view}
              sort={sort}
              filters={filters}
              views={views}
              activeViewId={activeViewId}
            />
          }
        />
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
