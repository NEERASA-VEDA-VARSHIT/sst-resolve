"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Edit, Trash2, Loader2, Building2, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Committee {
  id: number;
  name: string;
  description: string | null;
  contact_email: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface CommitteeMember {
  id: number;
  committee_id: number;
  clerk_user_id: string;
  role: string | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    emailAddresses: Array<{ emailAddress: string }>;
  };
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  name?: string;
  email?: string;
}

interface CommitteesManagementProps {
  initialCommittees: Committee[];
  initialMembers: Record<number, CommitteeMember[]>;
}

export function CommitteesManagement({ initialCommittees, initialMembers }: CommitteesManagementProps) {
  const router = useRouter();
  const [committees, setCommittees] = useState<Committee[]>(initialCommittees);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<Record<number, CommitteeMember[]>>(initialMembers);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [deletingCommitteeId, setDeletingCommitteeId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contact_email: "",
  });

  useEffect(() => {
    fetchClerkUsers();
  }, []);

  const fetchClerkUsers = async () => {
    try {
      const response = await fetch("/api/admin/list?include_committee=true");
      if (response.ok) {
        const data = await response.json();
        const committeeUsers = data.committeeUsers || (data.admins || []).filter((user: { publicMetadata?: { role?: string } }) => {
          return user.publicMetadata?.role === "committee";
        });
        setClerkUsers(committeeUsers);
      }
    } catch (error) {
      console.error("Error fetching Clerk users:", error);
    }
  };

  const refreshData = () => {
    router.refresh();
  };

  const handleOpenDialog = (committee?: Committee) => {
    if (committee) {
      setEditingCommittee(committee);
      setFormData({
        name: committee.name,
        description: committee.description || "",
        contact_email: committee.contact_email || "",
      });
    } else {
      setEditingCommittee(null);
      setFormData({
        name: "",
        description: "",
        contact_email: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCommittee(null);
    setFormData({
      name: "",
      description: "",
      contact_email: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Committee name is required");
      return;
    }

    setSaving(true);

    try {
      let response;
      if (editingCommittee) {
        response = await fetch(`/api/committees/${editingCommittee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            contact_email: formData.contact_email || null,
          }),
        });
      } else {
        response = await fetch("/api/committees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            contact_email: formData.contact_email || null,
          }),
        });
      }

      if (response.ok) {
        toast.success(editingCommittee ? "Committee updated successfully" : "Committee created successfully");
        handleCloseDialog();
        refreshData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save committee");
      }
    } catch (error) {
      console.error("Error saving committee:", error);
      toast.error("Failed to save committee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCommitteeId) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/committees/${deletingCommitteeId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Committee deleted successfully");
        setIsDeleteDialogOpen(false);
        setDeletingCommitteeId(null);
        refreshData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete committee");
      }
    } catch (error) {
      console.error("Error deleting committee:", error);
      toast.error("Failed to delete committee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Committee Management
          </h1>
          <p className="text-muted-foreground">
            Manage committees and assign members to committees
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Committee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCommittee ? "Edit Committee" : "Create New Committee"}</DialogTitle>
                <DialogDescription>
                  {editingCommittee ? "Update committee details" : "Create a new committee"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Committee Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Student Welfare Committee"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the committee's purpose"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="committee@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Primary email address for this committee
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingCommittee ? "Update" : "Create"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Committees List */}
      <div className="space-y-3">
        {committees.map((committee) => {
          const members = committeeMembers[committee.id] || [];
          
          return (
            <Card key={committee.id} className="border-2 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{committee.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {committee.description || "No description"}
                      </CardDescription>
                      {committee.contact_email && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📧 {committee.contact_email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      asChild
                    >
                      <Link href={`/superadmin/dashboard/committees/${committee.id}/tickets`}>
                        <FileText className="w-4 h-4 mr-2" />
                        View Tickets
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(committee)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeletingCommitteeId(committee.id);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {committee.contact_email && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium mb-1">Contact Email</p>
                    <p className="text-sm text-muted-foreground">
                      📧 {committee.contact_email}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Members ({members.length})</p>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No members assigned. The committee head (from contact email) is treated as the sole member.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => {
                        const clerkUser = clerkUsers.find(u => u.id === member.clerk_user_id);

                        let displayName = "Unknown User";
                        if (clerkUser) {
                          displayName =
                            `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
                            clerkUser.emailAddresses?.[0]?.emailAddress ||
                            clerkUser.email ||
                            clerkUser.id;
                        } else if (member.user) {
                          displayName =
                            `${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() ||
                            member.user.emailAddresses?.[0]?.emailAddress ||
                            "Unknown User";
                        }
                        
                        return (
                          <div key={member.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{displayName}</span>
                              {member.role && (
                                <Badge variant="secondary" className="text-xs">
                                  {member.role}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {committees.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-1">No committees</p>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Create committees to organize and manage ticket assignments
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Committee
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the committee and remove all member assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingCommitteeId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
