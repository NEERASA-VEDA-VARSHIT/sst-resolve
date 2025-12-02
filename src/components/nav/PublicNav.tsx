"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SignUpButton } from "@clerk/nextjs";
import Image from "next/image";

/**
 * Lightweight public navigation for the landing page.
 * Keeps things simple: logo, theme toggle, and auth links.
 */
export function PublicNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logosst.png" alt="SST Resolve" width={32} height={32} />
          <span className="hidden text-sm font-semibold sm:inline">
            SST Resolve
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {pathname !== "/sign-in" && (
            <Button asChild size="sm" variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <SignUpButton mode="modal">
              Sign up
            </SignUpButton>
          </Button>
        </div>
      </div>
    </header>
  );
}

