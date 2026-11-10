import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIssuePage } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { IssueDetail } from "@/components/issue-detail";

type Params = { projectKey: string; number: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { projectKey, number } = await params;
  return { title: `${projectKey.toUpperCase()}-${number}` };
}

export default async function IssuePage({ params }: { params: Promise<Params> }) {
  const { projectKey, number: rawNumber } = await params;
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number < 1) notFound();
  const user = await requireUser();
  const data = await getIssuePage(user.id, projectKey, number);
  if (!data) notFound();
  return (
    <IssueDetail
      project={data.project}
      issue={data.issue}
      comments={data.comments}
      activities={data.activities}
      members={data.members}
      labels={data.labels}
      currentUser={user}
    />
  );
}
