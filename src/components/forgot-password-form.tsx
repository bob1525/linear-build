"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { LogoMark } from "@/components/icons";
import { Button, ErrorNote, Field, TextField } from "@/components/ui";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    setPending(true);
    const result = await requestPasswordResetAction({ email: String(form.get("email") ?? "") });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
  }

  return (
    <div id="content" className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.22),transparent_52%)]" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="h-9 w-9" />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-[13px] text-ink-muted">The link expires in 30 minutes and works once.</p>
        </div>
        <div className="rounded-xl border border-line bg-panel/90 p-5 shadow-pop">
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {message ? (
              <p data-testid="reset-requested" role="status" className="rounded-md border border-line bg-white/[0.03] px-3 py-2 text-[12px] text-ink">
                {message}
              </p>
            ) : null}
            <Field label="Email">
              <TextField name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : "Send reset link"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          <Link href="/login" className="text-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
