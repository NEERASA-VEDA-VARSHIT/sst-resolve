"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
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
import { User, Save, Loader2, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface StudentProfile {
  id: number;
  user_number: string;
  full_name: string;
  email: string;
  room_number: string | null;
  mobile: string | null;
  hostel: string | null;
  hostel_id: number | null;
  class_section: string | null;
  batch_year: number | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

interface Hostel {
  id: number;
  name: string;
}

export default function StudentProfilePage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);

  // Editable fields
  const [mobile, setMobile] = useState("");
  const [hostelId, setHostelId] = useState<number | string>("");
  const [roomNumber, setRoomNumber] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile");

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setMobile(data.mobile || "");
        setHostelId(data.hostel_id || "");
        setRoomNumber(data.room_number || "");
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

  const fetchHostels = useCallback(async () => {
    try {
      const response = await fetch("/api/hostels");
      if (response.ok) {
        const data = await response.json();
        setHostels(data);
      }
    } catch (error) {
      console.error("Error fetching hostels:", error);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user?.id) {
      fetchProfile();
      fetchHostels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const clean = mobile.replace(/\D+/g, "");

    if (!/^[6-9]\d{9}$/.test(clean)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }

    if (!hostelId) {
      toast.error("Please select a hostel");
      return;
    }

    if (!roomNumber.trim()) {
      toast.error("Please enter a room number");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: clean,
          hostel_id: Number(hostelId),
          room_number: roomNumber.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setProfile(data);
        toast.success("Profile updated successfully!");
      } else {
        toast.error(data.error || "Failed to update mobile number");
      }
    } catch (error) {
      console.error("Mobile update error:", error);
      toast.error("Failed to update. Try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------------------------------
      LOADING STATE
  ---------------------------------------------------- */
  if (!isLoaded || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ----------------------------------------------------
      PROFILE NOT FOUND BUT NEEDS LINK
  ---------------------------------------------------- */
  if (needsLink) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Linked</CardTitle>
            <CardDescription>
              Your student profile needs administrative linking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="mt-2">
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
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <User className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">My Profile</h1>
              <p className="text-muted-foreground">
                View your information and update hostel, room, and mobile
              </p>
            </div>
          </div>

          {/* Admin note */}
          <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <Lock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="ml-2">
              <strong className="block mb-1">
                Profile Managed by Administration
              </strong>
              You can update your hostel, room number, and mobile. Contact admin
              for other changes.
            </AlertDescription>
          </Alert>

          {/* Readonly Profile */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
              <CardDescription>
                Information managed by administration
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Roll + Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReadonlyField
                  label="Roll Number"
                  value={profile.user_number}
                />
                <ReadonlyField label="Full Name" value={profile.full_name} />
              </div>

              {/* Email */}
              <ReadonlyField label="Email Address" value={profile.email} />

              {/* Class + Batch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReadonlyField
                  label="Class Section"
                  value={profile.class_section ?? "Not Assigned"}
                />
                <ReadonlyField
                  label="Batch Year"
                  value={profile.batch_year?.toString() ?? "Not Assigned"}
                />
              </div>

              {/* Department */}
              {profile.department && (
                <ReadonlyField label="Department" value={profile.department} />
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground pt-4 border-t space-y-1">
                <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(profile.updated_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Editable Mobile */}
          {/* Editable Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Update Your Information</CardTitle>
              <CardDescription>
                You can update your hostel, room number, and mobile
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {/* Hostel */}
                <div>
                  <Label htmlFor="hostel">Hostel *</Label>
                  <select
                    id="hostel"
                    className="w-full border rounded-md p-2 mt-1 bg-background"
                    value={hostelId}
                    onChange={(e) => setHostelId(e.target.value)}
                    disabled={!hostels.length}
                    required
                  >
                    <option value="">Select hostel</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={String(h.id)}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Number */}
                <div>
                  <Label htmlFor="room">Room Number *</Label>
                  <Input
                    id="room"
                    value={roomNumber}
                    onChange={(e) => {
                      const clean = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9\- ]/g, "");
                      setRoomNumber(clean);
                    }}
                    placeholder="Enter room number"
                    required
                    className="mt-1"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <Label htmlFor="mobile">Mobile Number *</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a valid 10-digit mobile number
                  </p>
                </div>

                <Button disabled={saving} type="submit">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* Helper component for readonly fields */
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground flex items-center gap-2">
        <Lock className="w-3 h-3" /> {label}
      </Label>
      <Input
        value={value}
        readOnly
        disabled
        className="bg-muted cursor-not-allowed mt-1"
      />
    </div>
  );
}
