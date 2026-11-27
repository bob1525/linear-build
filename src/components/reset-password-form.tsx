"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions/auth";
import { LogoMark } from "@/components/icons";
import { Button, ErrorNote, Field, TextField } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    const result = await resetPasswordAction({
      token,
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push(result.data.redirectTo);
  }

  return (
    <div id="content" className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.22),transparent_52%)]" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="h-9 w-9" />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Other sessions for this account are signed out.</p>
        </div>
        <div className="rounded-xl border border-line bg-panel/90 p-5 shadow-pop">
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Field label="New password" hint="At least 8 characters.">
              <TextField name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
            </Field>
            <Field label="Confirm new password">
              <TextField name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : "Save new password"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          <Link href="/forgot-password" className="text-ink hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
