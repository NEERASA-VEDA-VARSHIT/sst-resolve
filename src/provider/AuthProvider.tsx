"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import type { Roles } from "@/types/globals";

interface AuthContextType {
    userId: string | null;
    user: ReturnType<typeof useUser>["user"];
    isLoaded: boolean;
    role: Roles | null;
    userNumber: string | null;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Auth Provider
 * Provides authentication state and user information throughout the app
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const { user, isLoaded } = useUser();
    const userId = user?.id;
    const [role, setRole] = useState<Roles | null>(null);
    const [, setRoleLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            setRoleLoading(true);
            fetch(`/api/users/${user.id}/role`)
                .then(res => res.json())
                .then(data => {
                    setRole((data.primaryRole as Roles) || null);
                })
                .catch(() => {
                    setRole(null);
                })
                .finally(() => {
                    setRoleLoading(false);
                });
        } else {
            setRoleLoading(false);
            setRole(null);
        }
    }, [user?.id]);

    const userNumber = (user?.publicMetadata?.userNumber as string) || null;
    const isAdmin = role === "admin" || role === "super_admin";
    const isSuperAdmin = role === "super_admin";
    const isStudent = role === "student" || !role;

    const value: AuthContextType = {
        userId,
        user,
        isLoaded,
        role,
        userNumber,
        isAdmin,
        isSuperAdmin,
        isStudent,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

