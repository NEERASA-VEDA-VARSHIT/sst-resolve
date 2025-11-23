"use client";

import Link from "next/link";
import { useUser, SignOutButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { LogOut, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRole, getProfileLinkForRole, getRoleDisplayName } from "./nav-items";

type NavUserMenuProps = {
  role: UserRole;
  variant?: "desktop" | "mobile";
};

/**
 * User profile dropdown menu component
 * Handles both desktop and mobile variants
 */
export function NavUserMenu({ role, variant = "desktop" }: NavUserMenuProps) {
  const { user } = useUser();
  const profileLink = getProfileLinkForRole(role);
  const roleDisplayName = getRoleDisplayName(role);

  if (variant === "desktop") {
    return (
      <>
        <SignedIn>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-3 h-auto py-2 hover:bg-accent">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0] || "U"}
                  </div>
                  <div className="hidden xl:block text-left">
                    <p className="text-sm font-medium leading-tight">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.emailAddresses[0]?.emailAddress?.split("@")[0] || "User"}
                    </p>
                    <Badge variant="secondary" className="text-xs mt-0.5">
                      {roleDisplayName}
                    </Badge>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground hidden xl:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.emailAddresses[0]?.emailAddress?.split("@")[0] || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.emailAddresses[0]?.emailAddress || ""}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={profileLink} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <SignOutButton>
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </SignOutButton>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">Sign In</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Sign Up</Button>
          </SignUpButton>
        </SignedOut>
      </>
    );
  }

  // Mobile variant
  return (
    <>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0] || "U"}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.emailAddresses[0]?.emailAddress?.split("@")[0] || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.emailAddresses[0]?.emailAddress || ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={profileLink} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SignOutButton>
              <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

