"use client";

import { usePathname } from "next/navigation";
import { UnifiedNav } from "./UnifiedNav";

/**
 * Conditionally renders UnifiedNav only on public routes (home page)
 * Role-specific routes use their own navigation via role layouts
 */
export function ConditionalNav() {
  const pathname = usePathname();

  // Only show UnifiedNav on home page (public route)
  // All role-specific routes have their own navigation via layouts
  if (pathname === "/") {
    return <UnifiedNav />;
  }

  // Role-specific routes handle their own navigation
  // via student/layout.tsx, admin/layout.tsx, etc.
  return null;
}

