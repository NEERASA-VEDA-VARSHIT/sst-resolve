import {
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  Users,
  BarChart3,
  Tag,
  LucideIcon,
} from "lucide-react";
import { UserRole } from "./useRole";

// Re-export UserRole for convenience
export type { UserRole };

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  show: boolean;
};

/**
 * Pure function that returns navigation items based on user role
 * This is the single source of truth for navigation items
 */
export function getNavItemsForRole(role: UserRole, mounted: boolean): NavItem[] {
  if (!mounted) return [];

  const isSuperAdmin = role === "super_admin";
  const isCommittee = role === "committee";
  const isRegularAdmin = role === "admin";

  const items: NavItem[] = [
    // ============================================
    // STUDENT NAVIGATION
    // ============================================
    // Note: Logo links to /student/dashboard
    // Students can access Create Ticket and Profile from the dashboard
    // No nav items needed - everything is accessible from the dashboard

    // ============================================
    // ADMIN NAVIGATION
    // ============================================
    // Note: Logo links to /admin/dashboard, so "Dashboard" is redundant
    ...(isRegularAdmin
      ? [
          {
            title: "Today",
            href: "/admin/dashboard/today",
            icon: Calendar,
            show: true,
          },
          {
            title: "Escalated",
            href: "/admin/dashboard/escalated",
            icon: AlertCircle,
            show: true,
          },
          {
            title: "Analytics",
            href: "/admin/dashboard/analytics",
            icon: TrendingUp,
            show: true,
          },
          {
            title: "Groups",
            href: "/admin/dashboard/groups",
            icon: Users,
            show: true,
          },
        ]
      : []),

    // ============================================
    // COMMITTEE NAVIGATION
    // ============================================
    // Note: Logo links to /committee/dashboard, so "Dashboard" is redundant
    ...(isCommittee
      ? [
          {
            title: "Created",
            href: "/committee/dashboard/created",
            icon: FileText,
            show: true,
          },
          {
            title: "Tagged",
            href: "/committee/dashboard/tagged",
            icon: Tag,
            show: true,
          },
          {
            title: "Today",
            href: "/committee/dashboard/today",
            icon: Calendar,
            show: true,
          },
          {
            title: "Escalated",
            href: "/committee/dashboard/escalated",
            icon: AlertCircle,
            show: true,
          },
          {
            title: "Groups",
            href: "/committee/dashboard/groups",
            icon: Users,
            show: true,
          },
        ]
      : []),

    // ============================================
    // SUPER ADMIN NAVIGATION
    // ============================================
    // Note: Logo links to /superadmin/dashboard, so "Dashboard" is redundant
    ...(isSuperAdmin
      ? [
          {
            title: "All Tickets",
            href: "/superadmin/tickets",
            icon: FileText,
            show: true,
          },
          {
            title: "Today",
            href: "/superadmin/dashboard/today",
            icon: Calendar,
            show: true,
          },
          {
            title: "Escalated",
            href: "/superadmin/dashboard/escalated",
            icon: AlertCircle,
            show: true,
          },
          {
            title: "Analytics",
            href: "/superadmin/analytics",
            icon: BarChart3,
            show: true,
          },
          {
            title: "Groups",
            href: "/superadmin/dashboard/groups",
            icon: Users,
            show: true,
          },
          // Management sections (Categories, Staff, Students, Master Data, Notifications)
          // are now available only in the collapsible SuperAdminSideNav, not top nav.
          {
            title: "Committees",
            href: "/superadmin/dashboard/committees",
            icon: Users,
            show: true,
          },
        ]
      : []),
  ];

  return items.filter((item) => item.show);
}

/**
 * Get dashboard link based on user role
 */
export function getDashboardLinkForRole(role: UserRole): string {
  if (role === "super_admin") return "/superadmin/dashboard";
  if (role === "admin") return "/admin/dashboard";
  if (role === "committee") return "/committee/dashboard";
  return "/student/dashboard";
}

/**
 * Get profile link based on user role
 */
export function getProfileLinkForRole(role: UserRole): string {
  if (role === "super_admin") return "/superadmin/profile";
  if (role === "admin") return "/admin/profile";
  if (role === "committee") return "/committee/dashboard";
  return "/student/profile";
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "committee":
      return "Committee";
    case "student":
      return "Student";
    default:
      return "Student";
  }
}
