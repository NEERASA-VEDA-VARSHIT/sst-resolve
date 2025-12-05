"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NavUserMenu } from "./NavUserMenu";
import { getDashboardLinkForRole } from "./nav-items";
import { UserRole } from "@/hooks/auth/useRole";

type MobileTopNavProps = {
  role: UserRole;
  mounted: boolean;
};

/**
 * Mobile top navigation bar
 * Renders logo, theme toggle, and user menu for mobile views
 */
export function MobileTopNav({ role, mounted }: MobileTopNavProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href={getDashboardLinkForRole(role)} className="flex items-center gap-2">
          <Image
            src="/logosst.png"
            alt="SST Resolve Logo"
            width={32}
            height={32}
            className="object-contain"
          />
          <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            SST Resolve
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {mounted && <NavUserMenu role={role} variant="mobile" />}
        </div>
      </div>
    </header>
  );
}

