import { Suspense } from "react";
import { SuperAdminNav } from "@/components/nav/SuperAdminNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Super Admin Role Root Layout
 * Handles navigation and layout for all superadmin routes
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <SuperAdminNav />
      </Suspense>
      {children}
    </>
  );
}

