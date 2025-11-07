import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = (sessionClaims as any)?.metadata?.role || "student";
  if (role === "student") {
    redirect("/student/dashboard");
  }

  return (
    <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
      <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}


