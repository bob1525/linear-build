import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPath } from "@/lib/data";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(await getLandingPath(user.id));
  return <AuthForm mode="signup" />;
}
