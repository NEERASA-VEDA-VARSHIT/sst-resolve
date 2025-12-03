"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Shield,
  GraduationCap,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SIDE_ITEMS = [
  {
    title: "Categories",
    href: "/superadmin/dashboard/categories",
    icon: Building2,
  },
  {
    title: "Staff",
    href: "/superadmin/dashboard/staff",
    icon: Shield,
  },
  {
    title: "Students",
    href: "/superadmin/students",
    icon: GraduationCap,
  },
  {
    title: "Master Data",
    href: "/superadmin/dashboard/master-data",
    icon: Settings,
  },
  {
    title: "Notifications",
    href: "/superadmin/dashboard/notification-settings",
    icon: Bell,
  },
] as const;

type SuperAdminSideNavProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SuperAdminSideNav({ open = false, onOpenChange }: SuperAdminSideNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed left-0 top-16 h-[calc(100vh-4rem)] border-r bg-background/95 backdrop-blur z-40 transition-all",
        open ? "w-56" : "w-14"
      )}
    >
      <div className="flex flex-col h-full w-full">
        <div className="flex justify-end p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange?.(!open)}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-1 pb-4">
          {SIDE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {open && <span className="truncate">{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

