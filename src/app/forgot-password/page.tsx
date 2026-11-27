import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { LogoMark } from "@/components/icons";
import { resolveMail } from "@/lib/mail-config";
import { RESET_UNAVAILABLE } from "@/lib/password-reset";

// Mail mode is read from this process. A static page would keep the build machine's env.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  const mail = resolveMail();
  if (mail.mode === "disabled") {
    return (
      <div id="content" className="relative flex min-h-full items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-[420px] text-center">
          <LogoMark className="mx-auto h-9 w-9" />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Reset your password</h1>
          <p data-testid="reset-unavailable" className="mt-3 text-[13px] leading-6 text-ink-muted">
            {RESET_UNAVAILABLE}
          </p>
          <p className="mt-6 text-[13px] text-ink-muted">
            <Link href="/login" className="text-ink hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <ForgotPasswordForm />;
}
