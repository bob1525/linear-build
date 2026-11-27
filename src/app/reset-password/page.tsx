import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { LogoMark } from "@/components/icons";
import { RESET_INVALID } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  if (token.length < 20) {
    return (
      <div id="content" className="relative flex min-h-full items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-[420px] text-center">
          <LogoMark className="mx-auto h-9 w-9" />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Choose a new password</h1>
          <p data-testid="reset-invalid" className="mt-3 text-[13px] leading-6 text-ink-muted">
            {RESET_INVALID}
          </p>
          <p className="mt-6 text-[13px] text-ink-muted">
            <Link href="/forgot-password" className="text-ink hover:underline">
              Request a new link
            </Link>
          </p>
        </div>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
