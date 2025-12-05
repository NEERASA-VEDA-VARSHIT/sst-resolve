import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { getDashboardPath, type UserRole } from "@/types/auth";
import { getUserRole, ensureUser } from "@/lib/auth/api-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  await ensureUser(userId);

  const role = await getUserRole(userId);

  redirect(getDashboardPath(role as UserRole));
}
