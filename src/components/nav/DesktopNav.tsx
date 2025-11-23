"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NavUserMenu } from "./NavUserMenu";
import { NavItem, getDashboardLinkForRole } from "./nav-items";
import { UserRole } from "./useRole";
import { isRouteActive } from "./nav-utils";

type DesktopNavProps = {
  role: UserRole;
  navItems: NavItem[];
  mounted: boolean;
};

/**
 * Desktop navigation component
 * Renders top navbar for desktop/tablet views (lg and above)
 */
export function DesktopNav({ role, navItems, mounted }: DesktopNavProps) {
  const pathname = usePathname();

  return (
    <header className="hidden lg:block sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full">
        <div className="flex h-16 items-center px-6">
          {/* Logo - Far left */}
          <Link href={getDashboardLinkForRole(role)} className="flex items-center gap-2 group">
            <Image
              src="/logosst.png"
              alt="SST Resolve Logo"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              SST Resolve
            </span>
          </Link>

          {/* Navigation Items - Center */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon;
              const allHrefs = navItems.map((i) => i.href);
              const active = isRouteActive(item.href, pathname, allHrefs);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative whitespace-nowrap",
                    active
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.title}</span>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions - Far right */}
          <div className="flex items-center gap-4 ml-auto mr-0">
            <ThemeToggle />
            {mounted && <NavUserMenu role={role} variant="desktop" />}
          </div>
        </div>
      </div>
    </header>
  );
}

