import { Suspense } from "react";
import { AdminNav } from "@/components/nav/AdminNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Admin Role Root Layout
 * Handles navigation and layout for all admin routes
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <AdminNav />
      </Suspense>
      {children}
    </>
  );
}

