import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/change-password-form";
import { mailStatusCopy, resolveMail } from "@/lib/mail-config";

export const metadata: Metadata = { title: "Change password" };

export default function AccountPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Account</p>
        <h1 id="change-password-heading" className="mt-2 text-[24px] font-semibold tracking-tight">
          Change password
        </h1>
        <p id="change-password-note" className="mt-2 text-[13px] leading-6 text-ink-muted">
          This replaces the password for the account you are signed in with. Other sessions for that account are signed out. This page does not email a reset link.
        </p>
        <p id="mail-status" data-testid="mail-status" className="mt-2 text-[13px] leading-6 text-ink-muted">
          {mailStatusCopy(resolveMail())}
        </p>
        <div className="mt-6 rounded-xl border border-line bg-panel p-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
