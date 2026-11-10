import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPath } from "@/lib/data";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(await getLandingPath(user.id));
}
