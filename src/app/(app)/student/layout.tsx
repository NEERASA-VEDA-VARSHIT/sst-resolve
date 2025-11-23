import { Suspense } from "react";
import { StudentNav } from "@/components/nav/StudentNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Student Role Root Layout
 * Handles navigation and layout for all student routes
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <StudentNav />
      </Suspense>
      {children}
    </>
  );
}

