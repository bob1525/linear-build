import { issueMatchesFilters, toFilterableIssue, type IssueFilters } from "@/lib/filters";
import type { ProjectPageData } from "@/lib/data";
import type { IssueSort, ViewType } from "@/lib/view-state";
import { EmptyState } from "@/components/empty-state";
import { BoardIcon } from "@/components/icons";
import { IssueBrowser } from "@/components/issue-browser";
import { NewIssueButton } from "@/components/shell-context";
import { ViewHeader } from "@/components/view-header";

export function ProjectScreen({
  data,
  view,
  filters,
  sort,
  showAll,
  activeViewId,
}: {
  data: ProjectPageData;
  view: ViewType;
  filters: IssueFilters;
  sort: IssueSort;
  showAll: boolean;
  activeViewId: string | null;
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
        sort={sort}
        showAll={showAll}
        members={data.members}
        labels={data.labels}
        views={data.views}
        activeViewId={activeViewId}
      />
      <div className="min-h-0 flex-1">
        {data.issues.length === 0 ? (
          <EmptyState
            icon={<BoardIcon />}
            title="No issues yet"
            body="Create the first issue for this project. It will show up on the board and in the list."
            action={<NewIssueButton />}
          />
        ) : (
          <IssueBrowser
            issues={filtered}
            projectKey={data.project.key}
            view={view}
            sort={sort}
            members={data.members}
            labels={data.labels}
            filters={filters}
          />
        )}
      </div>
    </div>
  );
}
