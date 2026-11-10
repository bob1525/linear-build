import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectPage } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { requireUser } from "@/lib/session";
import { ProjectScreen } from "@/components/project-screen";

type Params = { projectKey: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { projectKey } = await params;
  return { title: `${projectKey.toUpperCase()} issues` };
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ projectKey }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const data = await getProjectPage(user.id, projectKey);
  if (!data) notFound();
  return <ProjectScreen data={data} view="list" filters={parseFilters(sp)} />;
}
