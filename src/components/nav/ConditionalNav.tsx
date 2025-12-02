"use client";

import { usePathname } from "next/navigation";
import { PublicNav } from "./PublicNav";

/**
 * Conditionally renders a lightweight public nav only on the home page.
 * Role-specific routes use their own navigation via their layout files.
 */
export function ConditionalNav() {
  const pathname = usePathname();

  if (pathname === "/") {
    return <PublicNav />;
  }

  // Role-specific routes handle their own navigation
  // via student/layout.tsx, admin/layout.tsx, etc.
  return null;
}
