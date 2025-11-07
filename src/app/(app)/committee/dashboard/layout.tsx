import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function CommitteeDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || "student";

  if (role !== "committee") {
    redirect("/student/dashboard");
  }

  return (
    <div className="min-h-screen pt-16 lg:pt-0">
      {children}
    </div>
  );
}

