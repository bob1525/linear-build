"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/lib/actions/projects";
import { suggestProjectKey } from "@/lib/validators";
import { Button, ErrorNote, Field, TextArea, TextField } from "@/components/ui";

export function ProjectForm({ onDone, submitLabel = "Create project" }: { onDone?: () => void; submitLabel?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await createProjectAction({ name, key, description });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone?.();
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Field label="Project name">
        <TextField
          name="name"
          value={name}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!keyTouched) setKey(suggestProjectKey(next));
          }}
          placeholder="Orbit"
          required
          maxLength={60}
        />
      </Field>
      <Field label="Key" hint="Shown on issue IDs, like ORB-12. 2–5 letters or numbers.">
        <TextField
          name="key"
          value={key}
          onChange={(event) => {
            setKeyTouched(true);
            setKey(event.target.value.toUpperCase());
          }}
          placeholder="ORB"
          required
          maxLength={5}
          className="font-mono uppercase"
        />
      </Field>
      <Field label="Description">
        <TextArea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this project tracks"
          className="min-h-20"
          maxLength={280}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
