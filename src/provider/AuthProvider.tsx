"use client";

import { createContext, useContext, ReactNode } from "react";
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
  const userId = user?.id || null;
  
  const role = (user?.publicMetadata?.role as Roles) || null;
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

