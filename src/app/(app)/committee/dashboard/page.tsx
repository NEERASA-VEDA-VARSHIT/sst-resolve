import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Main committee dashboard page with navigation tabs
 * Redirects to /committee/dashboard/created by default
 */
export default async function CommitteeDashboardPage() {
  // Redirect to created page by default
  redirect("/committee/dashboard/created");
}

