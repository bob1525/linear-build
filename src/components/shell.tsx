"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import type { ProjectSummary, UserDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/avatar";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { BoardIcon, CloseIcon, ListIcon, LogoMark, LogoutIcon, MenuIcon, PlusIcon } from "@/components/icons";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { ProjectSearch } from "@/components/project-search";
import { ShellContext } from "@/components/shell-context";
import { Kbd } from "@/components/ui";

type Toast = { id: number; message: string; href?: string };

export function AppShell({
  user,
  projects,
  children,
}: {
  user: UserDTO;
  projects: ProjectSummary[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const projectKey = pathname.match(/^\/p\/([^/]+)/)?.[1]?.toUpperCase() ?? null;
  const current = projects.find((project) => project.key === projectKey) ?? null;

  const value = useMemo(
    () => ({
      openNewIssue: () => {
        if (current) setIssueOpen(true);
        else setProjectOpen(true);
      },
      openCreateProject: () => setProjectOpen(true),
      notify: (message: string, href?: string) => setToast({ id: Date.now(), message, href }),
    }),
    [current],
  );

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        Boolean(target?.isConnected) &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          Boolean(target?.isContentEditable));
      if (event.key === "Escape") {
        setNavOpen(false);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        value.openNewIssue();
      }
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-search]")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value]);

  async function logout() {
    setLoggingOut(true);
    const result = await logoutAction();
    if (result.ok) {
      router.push(result.data.redirectTo);
      router.refresh();
    }
    setLoggingOut(false);
  }

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-full min-h-0 bg-app text-[13px] text-ink">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-y-0 right-0 left-[248px] z-30 bg-black/50 md:hidden"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col border-r border-line bg-sidebar transition-transform md:static md:translate-x-0",
            navOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center gap-2 px-3 py-3.5">
            <LogoMark className="h-6 w-6" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight">Northstar</p>
              <p className="truncate text-[11px] text-ink-faint">Issue tracker</p>
            </div>
          </div>

          <div className="px-2">
            <button
              type="button"
              onClick={() => value.openCreateProject()}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ink-muted hover:bg-white/[0.04] hover:text-ink"
            >
              <PlusIcon />
              New project
            </button>
          </div>

          <nav aria-label="Projects" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Projects</p>
            {projects.length === 0 ? (
              <p className="px-2 py-2 text-[12px] leading-5 text-ink-faint">Create a project to start tracking issues.</p>
            ) : (
              <ul className="space-y-0.5">
                {projects.map((project) => {
                  const active = project.key === current?.key;
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/p/${project.key}`}
                        title={project.description}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-ink-muted hover:bg-white/[0.04] hover:text-ink",
                          active && "bg-white/[0.06] text-ink",
                        )}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        <span className="font-mono text-[10px] text-ink-faint">{project.key}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {current ? (
              <div className="mt-4">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Views</p>
                <Link
                  href={`/p/${current.key}?all=1`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-ink-muted hover:bg-white/[0.04] hover:text-ink",
                    pathname === `/p/${current.key}` && "bg-white/[0.06] text-ink",
                  )}
                >
                  <BoardIcon />
                  Board
                </Link>
                <Link
                  href={`/p/${current.key}/list?all=1`}
                  className={cn(
                    "mt-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-ink-muted hover:bg-white/[0.04] hover:text-ink",
                    pathname.startsWith(`/p/${current.key}/list`) && "bg-white/[0.06] text-ink",
                  )}
                >
                  <ListIcon />
                  List
                </Link>
              </div>
            ) : null}
          </nav>

          <div className="border-t border-line p-2">
            <p className="px-2 pb-2 text-[11px] text-ink-faint">
              <Kbd>C</Kbd> new issue <span className="px-1">·</span> <Kbd>/</Kbd> search
            </p>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <Avatar name={user.name} size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{user.name}</p>
                <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
              </div>
              <button
                type="button"
                aria-label="Log out"
                title="Log out"
                disabled={loggingOut}
                onClick={() => void logout()}
                className="rounded-md p-1.5 text-ink-faint hover:bg-white/[0.05] hover:text-ink disabled:opacity-50"
              >
                <LogoutIcon />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {projectKey ? (
            <div className="border-b border-line px-4 py-2">
              <ProjectSearch />
            </div>
          ) : null}
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
              className="rounded-md p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
            >
              <MenuIcon />
            </button>
            <LogoMark className="h-5 w-5" />
            <span className="font-medium">{current?.name ?? "Northstar"}</span>
            <button type="button" aria-label="Close menu" className="sr-only" onClick={() => setNavOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <main id="content" className="min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      <NewIssueDialog open={issueOpen} project={current} onClose={() => setIssueOpen(false)} />
      <CreateProjectDialog open={projectOpen} onClose={() => setProjectOpen(false)} />

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border border-line bg-[#1b1c22] px-3 py-2 shadow-pop" role="status">
          {toast.href ? (
            <Link href={toast.href} className="text-[13px] text-ink hover:underline" onClick={() => setToast(null)}>
              {toast.message}
            </Link>
          ) : (
            <p className="text-[13px]">{toast.message}</p>
          )}
        </div>
      ) : null}
    </ShellContext.Provider>
  );
}
