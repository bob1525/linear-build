import { redirect } from "next/navigation";
import { getProjectsForUser, getLandingPath } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { ProjectForm } from "@/components/project-form";

export default async function WelcomePage() {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);
  if (projects.length > 0) redirect(await getLandingPath(user.id));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-12">
        <p className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Welcome</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Your workspace is empty</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-muted">
          Projects group issues, labels, and the people working on them. Create one to open the board.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-panel p-4">
          <ProjectForm />
        </div>
      </div>
    </div>
  );
}
