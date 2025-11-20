import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { getDashboardPath } from "@/types/auth";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// Ensures session is not cached
export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  // Ensure user exists in DB
  const dbUser = await getOrCreateUser(userId);

  // If Clerk user was deleted → dbUser = null → force logout
  if (!dbUser) {
    redirect("/");
  }

  // Fetch role from DB (single source of truth)
  const role = await getUserRoleFromDB(userId);

  // Redirect based on role
  redirect(getDashboardPath(role));
}
