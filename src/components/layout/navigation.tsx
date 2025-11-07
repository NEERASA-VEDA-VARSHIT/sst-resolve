"use client";

import Link from "next/link";
import {
    SignInButton,
    SignOutButton, SignedIn, SignedOut, SignUpButton,
    //UserButton 
} from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

export const Navigation = () => {
    const { user } = useUser();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const role = ((user?.publicMetadata as any)?.role as string | undefined) || "student";
    const isAdmin = role === "admin" || role === "super_admin";
    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
                <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    SST Resolve
                </Link>

                <div className="flex items-center gap-2">
                    {mounted ? (
                        <>
                            <ThemeToggle />
                            <SignedOut>
                                <SignInButton mode="modal">
                                    <Button variant="ghost" size="sm" className="text-sm font-medium">Sign in</Button>
                                </SignInButton>
                                <SignUpButton mode="modal">
                                    <Button size="sm" className="text-sm font-medium">Sign up</Button>
                                </SignUpButton>
                            </SignedOut>
                            <SignedIn>
                                <Link href="/public">
                                    <Button variant="ghost" size="sm" className="text-sm font-medium">Public</Button>
                                </Link>
                                {!isAdmin && (
                                    <Link href="/student/dashboard">
                                        <Button variant="ghost" size="sm" className="text-sm font-medium">Dashboard</Button>
                                    </Link>
                                )}
                                {isAdmin && (
                                    <Link href={role === "super_admin" ? "/superadmin/dashboard" : "/admin/dashboard"}>
                                        <Button variant="ghost" size="sm" className="text-sm font-medium">Admin</Button>
                                    </Link>
                                )}
                                {/* Profile for students only */}
                                {!isAdmin && (
                                    <Link href="/profile">
                                        <Button variant="ghost" size="sm" className="text-sm font-medium">
                                            <UserIcon className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                )}
                                <SignOutButton>
                                    <Button variant="outline" size="sm" className="text-sm font-medium">Log out</Button>
                                </SignOutButton>
                            </SignedIn>
                        </>
                    ) : (
                        <div className="h-9 w-9" /> // Placeholder for theme toggle
                    )}
                </div>
            </div>
        </nav>
    );
}
