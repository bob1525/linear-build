import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPath } from "@/lib/data";
import { DEMO_PASSWORD, DEMO_USERS, PRIMARY_DEMO } from "@/lib/demo-accounts";
import { showDemoCredentials } from "@/lib/demo-hint";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(await getLandingPath(user.id));
  const showDemo = showDemoCredentials();
  return (
    <AuthForm
      mode="login"
      demo={
        showDemo
          ? {
              email: PRIMARY_DEMO.email,
              password: DEMO_PASSWORD,
              accounts: DEMO_USERS.map((account) => ({ name: account.name, email: account.email })),
            }
          : undefined
      }
    />
  );
}
