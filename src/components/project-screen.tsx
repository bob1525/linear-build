import { hasActiveFilters, issueMatchesFilters, toFilterableIssue, type IssueFilters } from "@/lib/filters";
import type { ProjectPageData } from "@/lib/data";
import { Board } from "@/components/board";
import { EmptyState } from "@/components/empty-state";
import { BoardIcon, SearchIcon } from "@/components/icons";
import { IssueList } from "@/components/issue-list";
import { NewIssueButton } from "@/components/shell-context";
import { ViewHeader } from "@/components/view-header";
import { ClearFilters } from "@/components/clear-filters";

export function ProjectScreen({
  data,
  view,
  filters,
}: {
  data: ProjectPageData;
  view: "board" | "list";
  filters: IssueFilters;
}) {
  const filtered = data.issues.filter((issue) => issueMatchesFilters(toFilterableIssue(issue), filters));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewHeader
        project={data.project}
        view={view}
        shown={filtered.length}
        total={data.issues.length}
        filters={filters}
        members={data.members}
        labels={data.labels}
      />
      <div className="min-h-0 flex-1">
        {data.issues.length === 0 ? (
          <EmptyState
            icon={<BoardIcon />}
            title="No issues yet"
            body="Create the first issue for this project. It will show up on the board and in the list."
            action={<NewIssueButton />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title="No issues match these filters"
            body="Status, priority, assignee, and label filters combine. Clear them to see the full project again."
            action={hasActiveFilters(filters) ? <ClearFilters /> : undefined}
          />
        ) : view === "board" ? (
          <Board issues={filtered} projectKey={data.project.key} />
        ) : (
          <IssueList issues={filtered} projectKey={data.project.key} />
        )}
      </div>
    </div>
  );
}
