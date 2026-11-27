"use client";

import { Dialog } from "@/components/dialog";
import { ProjectForm } from "@/components/project-form";

export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Dialog title="New project" description="Projects keep their own issues, labels, and members." onClose={onClose}>
      <div className="p-4">
        <ProjectForm onDone={onClose} />
      </div>
    </Dialog>
  );
}
