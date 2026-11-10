"use client";

import { createContext, useContext } from "react";
import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui";

type ShellContextValue = {
  openNewIssue: () => void;
  openCreateProject: () => void;
  notify: (message: string, href?: string) => void;
};

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside the workspace shell");
  return value;
}

export function NewIssueButton({ className }: { className?: string }) {
  const shell = useShell();
  return (
    <Button onClick={shell.openNewIssue} className={className}>
      <PlusIcon />
      New issue
    </Button>
  );
}
