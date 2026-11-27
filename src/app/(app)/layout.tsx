import type { ReactNode } from "react";
import { getProjectsForUser } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  return (
    <AppShell user={user} projects={projects}>
      {children}
    </AppShell>
  );
}
