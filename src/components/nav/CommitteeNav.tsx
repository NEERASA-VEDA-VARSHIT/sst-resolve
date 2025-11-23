"use client";

import { useMemo, useState, useEffect } from "react";
import { getNavItemsForRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

/**
 * Committee Navigation Component
 * Handles navigation for committee role only
 * No role fetching needed - this is only used in committee layout
 */
export function CommitteeNav() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize nav items for committee role
  const navItems = useMemo(() => {
    return getNavItemsForRole("committee", mounted);
  }, [mounted]);

  if (!mounted) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav role="committee" navItems={navItems} mounted={mounted} />
      <MobileTopNav role="committee" mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}

