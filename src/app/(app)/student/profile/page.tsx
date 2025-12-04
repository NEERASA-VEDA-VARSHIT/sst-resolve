"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Loader2, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { StudentProfile } from "@/db/types-only";

export default function StudentProfilePage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [needsLink, setNeedsLink] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile");

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else if (response.status === 404) {
        const data = await response.json();
        if (data.needsLink) setNeedsLink(true);
        toast.error("Profile not found. Contact administration.");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user?.id) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  /* ----------------------------------------------------
      LOADING STATE
  ---------------------------------------------------- */
  if (!isLoaded || loading) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ----------------------------------------------------
      PROFILE NOT FOUND BUT NEEDS LINK
  ---------------------------------------------------- */
  if (needsLink) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Profile Not Linked</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Your student profile needs administrative linking.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="mt-2 text-xs sm:text-sm">
                Please contact the administration office to complete your
                profile setup.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ----------------------------------------------------
      PROFILE MISSING REGULAR
  ---------------------------------------------------- */
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <Alert>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm">
                Please contact administration to have your student profile
                created.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ----------------------------------------------------
      MAIN PROFILE UI
  ---------------------------------------------------- */
  return (
    <div className="flex h-[calc(100vh-73px)]">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <User className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                View your student information
              </p>
            </div>
          </div>

          {/* Admin note */}
          <Alert className="mb-4 sm:mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <Lock className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <AlertDescription className="ml-2 text-sm sm:text-base">
              <strong className="block mb-1 text-sm sm:text-base">
                Profile Managed by Administration
              </strong>
              <span className="text-xs sm:text-sm">
                All profile information is managed by administration. Contact admin for any changes.
              </span>
            </AlertDescription>
          </Alert>

          {/* Readonly Profile */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Student Information</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Information managed by administration
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
              {/* Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ReadonlyField label="Full Name" value={profile.full_name} />
              </div>

              {/* Email */}
              <ReadonlyField label="Email Address" value={profile.email} />

              {/* Class + Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ReadonlyField
                  label="Class Section"
                  value={profile.class_section ?? "Not Assigned"}
                />
                <ReadonlyField
                  label="Batch Year"
                  value={profile.batch_year?.toString() ?? "Not Assigned"}
                />
              </div>

              {/* Hostel + Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ReadonlyField
                  label="Hostel"
                  value={profile.hostel ?? "Not Assigned"}
                />
                <ReadonlyField
                  label="Room Number"
                  value={profile.room_number ?? "Not Assigned"}
                />
              </div>

              {/* Mobile */}
              <ReadonlyField
                label="Mobile Number"
                value={profile.mobile ?? "Not Assigned"}
              />

              {/* Timestamps */}
              <div className="text-[10px] sm:text-xs text-muted-foreground pt-3 sm:pt-4 border-t space-y-1">
                <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(profile.updated_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* Helper component for readonly fields */
function ReadonlyField({ label, value }: { label: string; value: string | null | undefined }) {
  const displayValue = value ?? "Not Assigned";
  return (
    <div>
      <Label className="text-muted-foreground flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
        <Lock className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{label}</span>
      </Label>
      <Input
        value={displayValue}
        readOnly
        disabled
        className="bg-muted cursor-not-allowed mt-1 text-sm sm:text-base h-9 sm:h-10"
      />
    </div>
  );
}
