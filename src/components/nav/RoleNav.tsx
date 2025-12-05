"use client";

import { useMemo, useState, useEffect } from "react";
import { getNavItemsForRole, type UserRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

type RoleNavProps = {
  role: UserRole;
  sideNavOpen?: boolean;
  onToggleSideNav?: () => void;
};

/**
 * Unified Navigation Component
 * Handles navigation for all user roles
 * Replaces AdminNav, StudentNav, CommitteeNav, and SuperAdminNav
 */
export function RoleNav({ role, sideNavOpen, onToggleSideNav }: RoleNavProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize nav items for the specified role
  const navItems = useMemo(() => {
    return getNavItemsForRole(role, mounted);
  }, [role, mounted]);

  if (!mounted) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav
        role={role}
        navItems={navItems}
        mounted={mounted}
        sideNavOpen={sideNavOpen}
        onToggleSideNav={onToggleSideNav}
      />
      <MobileTopNav role={role} mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}
