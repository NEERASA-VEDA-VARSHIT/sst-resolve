"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavItem } from "./nav-items";
import { isRouteActive } from "./nav-utils";

type MobileBottomNavProps = {
  navItems: NavItem[];
};

/**
 * Mobile bottom navigation bar
 * Renders bottom navigation with icons and "More" dropdown for overflow items
 */
export function MobileBottomNav({ navItems }: MobileBottomNavProps) {
  const pathname = usePathname();

  const visibleItems = navItems.slice(0, 5);
  const overflowItems = navItems.slice(5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-1 max-w-screen overflow-x-auto scrollbar-hide">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const allHrefs = navItems.map((i) => i.href);
          const active = isRouteActive(item.href, pathname, allHrefs);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-colors min-w-[60px] max-w-[80px] relative",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", active && "scale-110")} />
              <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
                {item.title}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
        {/* Show "More" if there are more than 5 items */}
        {overflowItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex flex-col items-center justify-center gap-1 h-full min-w-[60px] max-w-[80px]"
              >
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                  <span className="text-[10px] font-bold">+{overflowItems.length}</span>
                </div>
                <span className="text-[10px] font-medium">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const allHrefs = navItems.map((i) => i.href);
                const active = isRouteActive(item.href, pathname, allHrefs);
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        active && "text-primary font-semibold"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}

