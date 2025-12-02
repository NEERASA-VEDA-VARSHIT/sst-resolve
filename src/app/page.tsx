import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { getDashboardPath } from "@/types/auth";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  const dbUser = await getOrCreateUser(userId);

  if (!dbUser) {
    redirect("/");
  }

  const role = await getUserRoleFromDB(userId);

  redirect(getDashboardPath(role));
}
