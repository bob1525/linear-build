import { notFound, redirect } from "next/navigation";
import { getProjectPage } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { hasExplicitViewQuery, parseSort, viewHref, type ViewType } from "@/lib/view-state";

type Search = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function openProjectView(userId: string, projectKey: string, searchParams: Search, viewType: ViewType) {
  const data = await getProjectPage(userId, projectKey);
  if (!data) notFound();
  if (!hasExplicitViewQuery(searchParams)) {
    const fallback = data.views.find((view) => view.isDefault);
    if (fallback) redirect(viewHref(data.project.key, fallback.viewType, fallback.filters, fallback.sort, fallback.id));
  }
  const activeViewId = first(searchParams.view);
  return {
    data,
    view: viewType,
    filters: parseFilters(searchParams),
    sort: parseSort(searchParams.sort),
    showAll: first(searchParams.all) === "1",
    activeViewId: activeViewId || null,
  };
}
