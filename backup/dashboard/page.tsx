import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || "student";

  // Redirect based on role
  if (role === "super_admin") {
    redirect("/dashboard/superadmin");
  } else if (role === "admin") {
    redirect("/dashboard/admin");
  } else {
    redirect("/dashboard/student");
  }
}
