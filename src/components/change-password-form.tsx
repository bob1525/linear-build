"use client";

import { useId, useState, type FormEvent } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { passwordFieldForError, type PasswordField } from "@/lib/a11y";
import { Button, ErrorNote, Field, TextField } from "@/components/ui";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();
  const statusId = useId();
  const invalid = error ? passwordFieldForError(error) : null;

  function focusField(field: PasswordField) {
    const id = field === "confirm" ? confirmId : field === "new" ? newId : currentId;
    document.getElementById(id)?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setDone(false);
    setPending(true);
    const result = await changePasswordAction({
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword: String(data.get("newPassword") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      focusField(passwordFieldForError(result.error));
      return;
    }
    form.reset();
    setDone(true);
    document.getElementById(statusId)?.focus();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      aria-labelledby="change-password-heading"
      aria-describedby="change-password-note mail-status"
      aria-busy={pending}
      className="space-y-3"
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {done ? (
        <p id={statusId} tabIndex={-1} role="status" data-testid="password-updated" className="rounded-md border border-line bg-white/[0.03] px-3 py-2 text-[12px] text-ink outline-none">
          Password updated. Other sessions were signed out.
        </p>
      ) : null}
      <Field label="Current password" invalid={invalid === "current"}>
        <TextField id={currentId} name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 8 characters." invalid={invalid === "new"}>
        <TextField id={newId} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </Field>
      <Field label="Confirm new password" invalid={invalid === "confirm"}>
        <TextField id={confirmId} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
