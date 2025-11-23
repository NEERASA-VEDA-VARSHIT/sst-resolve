/**
 * Navigation utility functions
 */

/**
 * Check if a route is active based on the current pathname
 * Only matches exact routes or direct child routes, prioritizing specificity
 * 
 * @param href - The href to check
 * @param pathname - The current pathname
 * @param allHrefs - All available hrefs to check for more specific matches
 * @returns true if the route should be considered active
 */
export function isRouteActive(
  href: string,
  pathname: string | null,
  allHrefs?: string[]
): boolean {
  if (!pathname) return false;

  // Exact match always wins
  if (pathname === href) return true;

  // For root path, only match exactly
  if (href === "/") return false;

  // Check if there's a more specific route that matches
  // If we're on /admin/dashboard/today, we should only highlight "Today", not "Dashboard"
  if (allHrefs) {
    const moreSpecificMatch = allHrefs.find((h) => {
      // Must be different from current href
      if (h === href) return false;
      // Must be a child of current href (more specific)
      if (!h.startsWith(href + "/")) return false;
      // Pathname must match the more specific route (exact or child)
      return pathname === h || pathname.startsWith(h + "/");
    });
    if (moreSpecificMatch) {
      // A more specific route exists and matches, so this one shouldn't be active
      return false;
    }
  }

  // Check if pathname is a direct child route
  // e.g., /student/dashboard should match /student/dashboard/ticket/new
  // but /admin/dashboard should NOT match /admin/dashboard-analytics
  if (pathname.startsWith(href + "/")) {
    return true;
  }

  return false;
}

