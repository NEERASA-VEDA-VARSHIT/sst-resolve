"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Settings, User } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const role = ((user?.publicMetadata as any)?.role as string | undefined) || "student";
  const isAdmin = role === "admin" || role === "super_admin";

  const navItems = isAdmin
    ? [
        {
          title: role === "super_admin" ? "Super Admin" : "Admin",
          href: role === "super_admin" ? "/superadmin/dashboard" : "/admin/dashboard",
          icon: Settings,
        },
        // Admin-only extra pages
        ...(role === "admin"
          ? [
              {
                title: "Today Pending",
                href: "/admin/dashboard/today",
                icon: FileText,
              },
              {
                title: "Escalated",
                href: "/admin/dashboard/escalated",
                icon: LayoutDashboard,
              },
              {
                title: "Analytics",
                href: "/admin/dashboard/analytics",
                icon: LayoutDashboard,
              },
            ]
          : []),
        ...(role === "super_admin"
          ? [
              {
                title: "All Tickets",
                href: "/superadmin/tickets",
                icon: LayoutDashboard,
              },
            ]
          : []),
      ]
    : [
        {
          title: "Dashboard",
          href: "/student/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Profile",
          href: "/profile",
          icon: User,
        },
      ];

  return (
    <aside className="w-64 border-r bg-gradient-to-b from-background to-muted/30 p-6 shadow-sm">
      <nav className="space-y-1">
        {mounted && navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "")} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

