"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, SignOutButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Home,
  Globe,
  Plus,
  LogOut,
  ChevronRight,
  User,
  Calendar,
  AlertCircle,
  TrendingUp,
  Users,
  Building2,
  Shield,
  BarChart3,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRole = "student" | "admin" | "super_admin" | "committee";

export function UnifiedNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  
  useEffect(() => {
    setMounted(true);
    
    // Fetch role from database API (single source of truth)
    if (user?.id) {
      fetch(`/api/auth/role?userId=${user.id}`, { cache: "no-store" })
        .then(res => res.json())
        .then(data => {
          if (data?.role) {
            setRole(data.role as UserRole);
          }
        })
        .catch(err => {
          console.error("[UnifiedNav] Error fetching role:", err);
          // Default to student on error
          setRole("student");
        });
    }
  }, [user?.id]);
  
  const isAdmin = role === "admin" || role === "super_admin" || role === "committee";
  const isSuperAdmin = role === "super_admin";
  const isCommittee = role === "committee";
  const isRegularAdmin = role === "admin";

  // Build navigation items based on role
  const navItems = mounted
    ? (
        [
          // Home for everyone
          {
            title: "Home",
            href: "/",
            icon: Home,
            show: true,
          },
          // Student dashboard
          {
            title: "My Tickets",
            href: "/student/dashboard",
            icon: FileText,
            show: role === "student",
          },
          // Admin dashboard items
          ...(isRegularAdmin || isCommittee
            ? [
                {
                  title: "Dashboard",
                  href: "/admin/dashboard",
                  icon: LayoutDashboard,
                  show: true,
                },
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
          // Super Admin dashboard items
          ...(isSuperAdmin
            ? [
                {
                  title: "Dashboard",
                  href: "/superadmin/dashboard",
                  icon: LayoutDashboard,
                  show: true,
                },
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
                  href: "/superadmin/dashboard/analytics",
                  icon: BarChart3,
                  show: true,
                },
                {
                  title: "Groups",
                  href: "/superadmin/dashboard/groups",
                  icon: Users,
                  show: true,
                },
                {
                  title: "Categories",
                  href: "/superadmin/dashboard/categories",
                  icon: Building2,
                  show: true,
                },
                {
                  title: "Staff",
                  href: "/superadmin/dashboard/staff",
                  icon: Shield,
                  show: true,
                },
                {
                  title: "Users",
                  href: "/superadmin/dashboard/users",
                  icon: User,
                  show: true,
                },
                {
                  title: "Forms",
                  href: "/superadmin/dashboard/forms",
                  icon: FileText,
                  show: true,
                },
                {
                  title: "Committees",
                  href: "/superadmin/dashboard/committees",
                  icon: Users,
                  show: true,
                },
                {
                  title: "Master Data",
                  href: "/superadmin/dashboard/master-data",
                  icon: Settings,
                  show: true,
                },
                {
                  title: "Ticket Assignment",
                  href: "/superadmin/settings/ticket-assignment",
                  icon: UserCheck,
                  show: true,
                },
              ]
            : []),
        ].filter((item) => item.show)
      )
    : [];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Desktop Top Navigation */}
      <header className="hidden lg:block sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full">
          <div className="flex h-16 items-center px-6">
            {/* Logo - Far left */}
            <Link href="/" className="flex items-center gap-2 group">
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
            <nav className="flex items-center gap-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                      active
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
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
              {mounted && (
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
                                {role === "super_admin" 
                                  ? "Super Admin" 
                                  : role === "admin" 
                                  ? "Admin" 
                                  : role === "committee" 
                                  ? "Committee" 
                                  : "Student"}
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
                          <>
                            <DropdownMenuSeparator />
                            {(role === "student" || role === "committee") && (
                              <DropdownMenuItem asChild>
                                <Link href={isCommittee ? "/committee/profile" : "/student/profile"} className="cursor-pointer">
                                  <User className="mr-2 h-4 w-4" />
                                  <span>Profile</span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </>
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
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-2 max-w-screen">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-colors min-w-0 relative",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0", active && "scale-110")} />
                <span className="text-xs font-medium truncate w-full text-center">{item.title}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
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
            {mounted && user && (
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
                  <>
                    <DropdownMenuSeparator />
                    {(role === "student" || role === "committee") && (
                      <DropdownMenuItem asChild>
                        <Link href={isCommittee ? "/committee/profile" : "/profile"} className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>Profile</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
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
          </div>
        </div>
      </header>
    </>
  );
}

