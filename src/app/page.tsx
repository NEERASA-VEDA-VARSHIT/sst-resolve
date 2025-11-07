import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Welcome to SST Resolve</h1>
          <p className="text-muted-foreground">Sign in to access your tickets and dashboard</p>
        </div>
      </div>
    );
  }

  const role = (sessionClaims as any)?.metadata?.role || "student";
  if (role === "super_admin") redirect("/superadmin/dashboard");
  if (role === "admin") redirect("/admin/dashboard");
  if (role === "committee") redirect("/committee/dashboard");
  redirect("/student/dashboard");
}
