"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, User, Mail, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Committee {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface CommitteeMember {
  id: number;
  committeeId: string;
  clerkUserId: string;
  role: string | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    emailAddresses: Array<{ emailAddress: string }>;
  };
}

export default function CommitteeProfilePage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [members, setMembers] = useState<CommitteeMember[]>([]);

  useEffect(() => {
    if (isLoaded && user) {
      fetchCommitteeProfile();
    }
  }, [isLoaded, user]);

  const fetchCommitteeProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/committee/profile");
      
      if (response.ok) {
        const data = await response.json();
        setCommittee(data.committee);
        setMembers(data.members || []);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to fetch committee profile");
      }
    } catch (error) {
      console.error("Error fetching committee profile:", error);
      toast.error("Failed to fetch committee profile");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Users className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold mb-2">No Committee Assigned</h2>
                <p className="text-sm text-muted-foreground">
                  You are not assigned to any committee yet. Please contact an administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Committee Profile</h1>
          <p className="text-muted-foreground">
            View your committee information and members
          </p>
        </div>
      </div>

      {/* Committee Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Committee Information
          </CardTitle>
          <CardDescription>
            Details about your committee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Committee Name</label>
            <p className="text-lg font-semibold mt-1">{committee.name}</p>
          </div>
          {committee.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-sm mt-1">{committee.description}</p>
            </div>
          )}
          {committee.createdAt && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Created: {new Date(committee.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Committee Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Committee Members ({members.length})
          </CardTitle>
          <CardDescription>
            All members of this committee
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No members found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const isCurrentUser = member.clerkUserId === user?.id;
                const displayName = member.user
                  ? `${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() || "No name"
                  : "Unknown User";
                const email = member.user?.emailAddresses[0]?.emailAddress || "";

                return (
                  <Card
                    key={member.id}
                    className={`border-2 ${isCurrentUser ? "border-primary bg-primary/5" : ""}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isCurrentUser ? "bg-primary/10" : "bg-muted"}`}>
                            <User className={`w-5 h-5 ${isCurrentUser ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="font-semibold flex items-center gap-2">
                              {displayName}
                              {isCurrentUser && (
                                <Badge variant="default" className="text-xs">You</Badge>
                              )}
                            </p>
                            {email && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">{email}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {member.role && (
                        <div className="pt-3 border-t">
                          <Badge variant="secondary" className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

