"use client";

import { useState } from "react";
import { Suspense } from "react";
import { SuperAdminNav } from "./SuperAdminNav";
import { SuperAdminSideNav } from "./SuperAdminSideNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

type SuperAdminLayoutShellProps = {
  children: React.ReactNode;
};

export function SuperAdminLayoutShell({ children }: SuperAdminLayoutShellProps) {
  const [sideNavOpen, setSideNavOpen] = useState(false);

  return (
    <>
      <Suspense fallback={<NavLoadingShimmer />}>
        <SuperAdminNav
          sideNavOpen={sideNavOpen}
          onToggleSideNav={() => setSideNavOpen((prev) => !prev)}
        />
      </Suspense>
      <div className="lg:flex">
        <SuperAdminSideNav open={sideNavOpen} onOpenChange={setSideNavOpen} />
        <main className={sideNavOpen ? "flex-1 lg:ml-56" : "flex-1"}>{children}</main>
      </div>
    </>
  );
}

