import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/profile-check";
import { getOrCreateUser } from "@/lib/user-sync";
import { ProgressBar } from "@/components/dashboard/ProgressBar";

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) redirect("/");

  // Ensure DB user exists for this Clerk ID
  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  // Safety check (UUID should always exist)
  if (!dbUser.id) {
    console.error("[StudentDashboardLayout] Missing dbUser.id", dbUser);
    redirect("/");
  }

  // Profile check must use DB UUID (not Clerk ID)
  const profileComplete = await isProfileComplete(dbUser.id);

  if (!profileComplete) {
    redirect("/student/profile");
  }

  return (
    <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
      <ProgressBar />
      <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
