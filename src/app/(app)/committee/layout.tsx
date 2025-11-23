import { Suspense } from "react";
import { CommitteeNav } from "@/components/nav/CommitteeNav";
import { NavLoadingShimmer } from "@/components/nav/NavLoadingShimmer";

/**
 * Committee Role Root Layout
 * Handles navigation and layout for all committee routes
 */
export default function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <CommitteeNav />
      </Suspense>
      {children}
    </>
  );
}

