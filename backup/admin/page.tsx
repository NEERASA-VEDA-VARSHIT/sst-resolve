import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Legacy admin route - redirects to new dashboard structure
 * This route is kept for backward compatibility with old bookmarks/links
 */
export default async function AdminPage() {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';
  
  // Redirect to new dashboard routes based on role
  if (role === 'super_admin') {
    redirect('/dashboard/superadmin');
  } else if (role === 'admin') {
    redirect('/dashboard/admin');
  } else {
    redirect('/dashboard/student');
  }
}

