"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction, signupAction } from "@/lib/actions/auth";
import { DEMO_PASSWORD, DEMO_USERS, PRIMARY_DEMO } from "@/lib/demo-accounts";
import { LogoMark } from "@/components/icons";
import { Button, ErrorNote, Field, TextField } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    const result =
      mode === "login"
        ? await loginAction({
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          })
        : await signupAction({
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            confirmPassword: String(form.get("confirmPassword") ?? ""),
          });
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push(result.data.redirectTo);
    router.refresh();
  }

  function useDemo() {
    setEmail(PRIMARY_DEMO.email);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div id="content" className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.22),transparent_52%)]" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="h-9 w-9" />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">
            {mode === "login" ? "Sign in to Northstar" : "Create your workspace"}
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">A lightweight issue tracker for product teams.</p>
        </div>
        <div className="rounded-xl border border-line bg-panel/90 p-5 shadow-pop">
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {mode === "signup" ? (
              <Field label="Name">
                <TextField name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Ava Chen" />
              </Field>
            ) : null}
            <Field label="Email">
              <TextField
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={mode === "login" ? email : undefined}
                onChange={mode === "login" ? (event) => setEmail(event.target.value) : undefined}
              />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <TextField
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={mode === "login" ? password : undefined}
                onChange={mode === "login" ? (event) => setPassword(event.target.value) : undefined}
              />
            </Field>
            {mode === "signup" ? (
              <Field label="Confirm password">
                <TextField name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
              </Field>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {mode === "login" ? (
            <div className="mt-4 rounded-lg border border-dashed border-line px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-ink">Demo workspace</p>
                  <p className="text-[12px] text-ink-muted">
                    {PRIMARY_DEMO.email} · {DEMO_PASSWORD}
                  </p>
                </div>
                <Button variant="subtle" size="sm" data-testid="demo-login" onClick={useDemo}>
                  Fill demo
                </Button>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-ink-faint">
                {DEMO_USERS.map((user) => (
                  <li key={user.email}>
                    {user.name} · {user.email}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href="/signup" className="text-ink hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-ink hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
