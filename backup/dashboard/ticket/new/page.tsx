"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { CATEGORY_TREE, LOCATIONS } from "@/lib/categories";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface StudentProfile {
  userNumber: string;
  hostel: string | null;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    location: "",
    subcategory: "",
    description: "",
    details: {} as Record<string, any>,
  });

  // Fetch student profile on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const response = await fetch("/api/profile");
        
        if (response.ok) {
          const data = await response.json();
          setStudentProfile({
            userNumber: data.userNumber,
            hostel: data.hostel,
          });
        } else if (response.status === 404) {
          // Profile not linked - redirect to profile page
          router.push("/profile");
          return;
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const isHostel = formData.category === "Hostel";
  const isCollege = formData.category === "College";

  const issueTypes = useMemo(() => {
    if (isHostel) return [
      "Mess Quality Issues",
      "Leave Application",
      "Maintenance / Housekeeping",
      "Wi-Fi Issues",
      "Room Change Request",
      "Other",
    ];
    if (isCollege) return [
      "Mess Quality Issues",
      "Maintenance / Housekeeping",
      "Wi-Fi Issues",
      "Other",
    ];
    return [];
  }, [isHostel, isCollege]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentProfile) {
      toast.error("Please complete your profile first");
      router.push("/profile");
      return;
    }

    setLoading(true);

    try {
      // Auto-fill userNumber and location (hostel) from student profile
      const ticketData = {
        ...formData,
        userNumber: studentProfile.userNumber,
        // If category is Hostel, use hostel from profile as location
        location: formData.category === "Hostel" && studentProfile.hostel 
          ? studentProfile.hostel 
          : formData.location,
      };

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      });

      if (response.ok) {
        const ticket = await response.json();
        toast.success("Ticket created successfully");
        router.push(`/dashboard/ticket/${ticket.id}`);
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to create ticket" }));
        toast.error(error.error || "Failed to create ticket");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>

          <div className="border rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-6">Create New Ticket</h1>

            {profileLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading your profile...</p>
              </div>
            ) : !studentProfile ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Please complete your profile first</p>
                <Link href="/profile">
                  <Button>Go to Profile</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Display user info (read-only) */}
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>User Number:</strong> {studentProfile.userNumber}
                  </p>
                  {studentProfile.hostel && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Hostel:</strong> {studentProfile.hostel}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        category: value,
                        location: "",
                        subcategory: "",
                        details: {},
                      });
                    }}
                    required
                  >
                    <SelectTrigger id="category" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hostel">Hostel</SelectItem>
                      <SelectItem value="College">College</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(isHostel || isCollege) && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Issue Type</Label>
                    <Select
                      value={formData.subcategory}
                      onValueChange={(value) => setFormData({ ...formData, subcategory: value, details: {} })}
                      required
                    >
                      <SelectTrigger id="subcategory" className="w-full">
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.subcategory === "Maintenance / Housekeeping" && isHostel && (
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceType">Maintenance Type</Label>
                    <Select
                      value={(formData.details as any).maintenanceType || ""}
                      onValueChange={(value) => setFormData({ ...formData, details: { ...formData.details, maintenanceType: value } })}
                      required
                    >
                      <SelectTrigger id="maintenanceType" className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Plumbing",
                          "Electrical",
                          "Painting",
                          "Carpenter",
                          "Pantry Area",
                        ].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.subcategory === "Mess Quality Issues" && isCollege && (
                  <div className="space-y-2">
                    <Label htmlFor="vendors">Vendors</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                      required
                    >
                      <SelectTrigger id="vendors" className="w-full">
                        <SelectValue placeholder="Select vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        {["GSR", "Uniworld", "TCB"].map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.subcategory === "Mess Quality Issues" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meal">Meal</Label>
                      <Select
                        value={(formData.details as any).meal || ""}
                        onValueChange={(value) => setFormData({ ...formData, details: { ...formData.details, meal: value } })}
                        required
                      >
                        <SelectTrigger id="meal" className="w-full">
                          <SelectValue placeholder="Select meal" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Breakfast','Lunch','Dinner'].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        required
                        value={(formData.details as any).date || ""}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, date: e.target.value } })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter ticket description"
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Link href="/dashboard">
                    <Button variant="outline" type="button" disabled={loading}>
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Ticket"}
                  </Button>
                </div>
              </form>
            )}
          </div>
    </div>
  );
}

