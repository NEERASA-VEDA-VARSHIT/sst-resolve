"use client";

import { useMemo, useState, useEffect } from "react";
import { getNavItemsForRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

/**
 * Admin Navigation Component
 * Handles navigation for admin role only
 * No role fetching needed - this is only used in admin layout
 */
export function AdminNav() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize nav items for admin role
  const navItems = useMemo(() => {
    return getNavItemsForRole("admin", mounted);
  }, [mounted]);

  if (!mounted) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav role="admin" navItems={navItems} mounted={mounted} />
      <MobileTopNav role="admin" mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}

