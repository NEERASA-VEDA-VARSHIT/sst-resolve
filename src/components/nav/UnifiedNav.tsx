"use client";

import { useMemo } from "react";
import { useRole } from "./useRole";
import { getNavItemsForRole } from "./nav-items";
import { DesktopNav } from "./DesktopNav";
import { MobileTopNav } from "./MobileTopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLoadingShimmer } from "./NavLoadingShimmer";

/**
 * Unified Navigation Component (Orchestrator)
 * 
 * This is the main entry point for navigation.
 * It only handles:
 * - Role detection via useRole hook
 * - Choosing which nav components to render
 * - Passing props to child components
 * 
 * All UI logic is delegated to specialized components:
 * - DesktopNav: Desktop top navbar
 * - MobileTopNav: Mobile top bar (logo + theme + profile)
 * - MobileBottomNav: Mobile bottom navigation
 */
export function UnifiedNav() {
  const { role, loading, mounted } = useRole();

  // Memoize nav items to prevent recalculation on every render
  const navItems = useMemo(() => {
    return getNavItemsForRole(role, mounted);
  }, [role, mounted]);

  // Show loading shimmer while fetching role
  if (loading) {
    return <NavLoadingShimmer />;
  }

  return (
    <>
      <DesktopNav role={role} navItems={navItems} mounted={mounted} />
      <MobileTopNav role={role} mounted={mounted} />
      <MobileBottomNav navItems={navItems} />
    </>
  );
}

