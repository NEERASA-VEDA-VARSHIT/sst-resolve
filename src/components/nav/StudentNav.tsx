"use client";

import { useMemo, useState, useEffect } from "react";
import { getNavItemsForRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

/**
 * Student Navigation Component
 * Handles navigation for student role only
 * No role fetching needed - this is only used in student layout
 */
export function StudentNav() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize nav items for student role
  const navItems = useMemo(() => {
    return getNavItemsForRole("student", mounted);
  }, [mounted]);

  if (!mounted) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav role="student" navItems={navItems} mounted={mounted} />
      <MobileTopNav role="student" mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}

