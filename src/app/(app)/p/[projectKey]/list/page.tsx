import type { Metadata } from "next";
import { openProjectView } from "@/lib/open-project";
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
  const screen = await openProjectView(user.id, projectKey, sp, "list");
  return <ProjectScreen {...screen} />;
}
