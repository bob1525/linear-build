import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata: Metadata = { title: "Change password" };

export default function AccountPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">Account</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Change password</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-muted">
          This replaces the password for the account you are signed in with. Other sessions for that account are signed out. This page does not email a reset link.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-panel p-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
