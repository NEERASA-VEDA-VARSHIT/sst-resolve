"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StudentProfile {
  id: number;
  userNumber: string;
  fullName: string | null;
  email: string | null;
  roomNumber: string | null;
  mobile: string | null;
  hostel: string | null;
  whatsappNumber: string | null;
  ticketsThisWeek: string | null;
  lastTicketDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface UseProfileReturn {
  profile: StudentProfile | null;
  loading: boolean;
  error: string | null;
  needsLink: boolean;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage student profile
 * Used in profile page and ticket creation
 */
export function useProfile(): UseProfileReturn {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/profile");
      
      if (response.status === 404) {
        const data = await response.json();
        if (data.needsLink) {
          setNeedsLink(true);
        }
        setProfile(null);
      } else if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setNeedsLink(false);
      } else {
        throw new Error("Failed to fetch profile");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    needsLink,
    refetch: fetchProfile,
  };
}

