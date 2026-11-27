"use client";

import { useState, type FormEvent } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { Button, ErrorNote, Field, TextField } from "@/components/ui";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

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
      return;
    }
    form.reset();
    setDone(true);
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {done ? (
        <p role="status" data-testid="password-updated" className="rounded-md border border-line bg-white/[0.03] px-3 py-2 text-[12px] text-ink">
          Password updated. Other sessions were signed out.
        </p>
      ) : null}
      <Field label="Current password">
        <TextField name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <TextField name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </Field>
      <Field label="Confirm new password">
        <TextField name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
