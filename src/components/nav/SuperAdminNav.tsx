"use client";

import { useMemo, useState, useEffect } from "react";
import { getNavItemsForRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

type SuperAdminNavProps = {
  sideNavOpen?: boolean;
  onToggleSideNav?: () => void;
};

/**
 * Super Admin Navigation Component
 * Handles navigation for super_admin role only
 * No role fetching needed - this is only used in superadmin layout
 */
export function SuperAdminNav({ sideNavOpen, onToggleSideNav }: SuperAdminNavProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize nav items for super_admin role
  const navItems = useMemo(() => {
    return getNavItemsForRole("super_admin", mounted);
  }, [mounted]);

  if (!mounted) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav
        role="super_admin"
        navItems={navItems}
        mounted={mounted}
        sideNavOpen={sideNavOpen}
        onToggleSideNav={onToggleSideNav}
      />
      <MobileTopNav role="super_admin" mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}

