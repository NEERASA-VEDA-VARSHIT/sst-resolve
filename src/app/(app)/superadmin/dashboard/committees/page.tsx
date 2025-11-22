"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Users, Plus, Edit, Trash2, UserPlus, UserMinus, Loader2, Building2, ArrowLeft } from "lucide-react";
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

export default function CommitteesManagementPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<Record<number, CommitteeMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);
  const [deletingCommitteeId, setDeletingCommitteeId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contact_email: "",
  });
  const [memberFormData, setMemberFormData] = useState({
    clerk_user_id: "",
    role: "member",
  });

  useEffect(() => {
    fetchCommittees();
    fetchClerkUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCommittees = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/committees");
      if (response.ok) {
        const data = await response.json();
        setCommittees(data.committees || []);
        // Fetch members for each committee
        for (const committee of data.committees || []) {
          fetchCommitteeMembers(committee.id);
        }
      } else {
        toast.error("Failed to fetch committees");
      }
    } catch (error) {
      console.error("Error fetching committees:", error);
      toast.error("Failed to fetch committees");
    } finally {
      setLoading(false);
    }
  };

  const fetchClerkUsers = async () => {
    try {
      // Fetch all users from Clerk API endpoint that returns users with committee role
      const response = await fetch("/api/admin/list?include_committee=true");
      if (response.ok) {
        const data = await response.json();
        // Use committee users if available, otherwise filter from admins
        const committeeUsers = data.committeeUsers || (data.admins || []).filter((user: { publicMetadata?: { role?: string } }) => {
          return user.publicMetadata?.role === "committee";
        });
        setClerkUsers(committeeUsers);
      }
    } catch (error) {
      console.error("Error fetching Clerk users:", error);
    }
  };

  const fetchCommitteeMembers = async (committeeId: number) => {
    try {
      const response = await fetch(`/api/committees/${committeeId}/members`);
      if (response.ok) {
        const data = await response.json();
        setCommitteeMembers(prev => ({
          ...prev,
          [committeeId]: data.members || [],
        }));
      }
    } catch (error) {
      console.error(`Error fetching members for committee ${committeeId}:`, error);
    }
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
        fetchCommittees();
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
        fetchCommittees();
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

  const handleOpenMemberDialog = (committee: Committee) => {
    setSelectedCommittee(committee);
    setMemberFormData({
      clerk_user_id: "",
      role: "member",
    });
    setIsMemberDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedCommittee || !memberFormData.clerk_user_id) {
      toast.error("Please select a user");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/committees/${selectedCommittee.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: memberFormData.clerk_user_id,
          role: memberFormData.role,
        }),
      });

      if (response.ok) {
        toast.success("Member added successfully");
        setIsMemberDialogOpen(false);
        fetchCommitteeMembers(selectedCommittee.id);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add member");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (committeeId: number, clerkUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the committee?")) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/committees/${committeeId}/members?clerk_user_id=${clerkUserId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Member removed successfully");
        fetchCommitteeMembers(committeeId);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to remove member");
      }
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    } finally {
      setSaving(false);
    }
  };

  // Get available users (not already in the committee)
  const getAvailableUsers = (committeeId: number) => {
    const currentMembers = committeeMembers[committeeId] || [];
    const currentMemberIds = currentMembers.map(m => m.clerk_user_id);
    return clerkUsers.filter(user => !currentMemberIds.includes(user.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
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
          <Button variant="outline" asChild>
            <Link href="/superadmin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
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
          // const availableUsers = getAvailableUsers(committee.id);
          
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
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMemberDialog(committee)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Manage Members
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
                    <p className="text-sm text-muted-foreground">No members assigned. Click &quot;Manage Members&quot; to add users.</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => {
                        const user = clerkUsers.find(u => u.id === member.clerk_user_id);
                        const displayName = user
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.emailAddresses?.[0]?.emailAddress || "Unknown"
                          : "Unknown User";
                        
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(committee.id, member.clerk_user_id)}
                              disabled={saving}
                            >
                              <UserMinus className="w-4 h-4 text-destructive" />
                            </Button>
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

      {/* Add Member Dialog */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {selectedCommittee?.name}</DialogTitle>
            <DialogDescription>
              Select a user with committee role to add to this committee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clerk_user_id">Select User *</Label>
              <Select
                value={memberFormData.clerk_user_id}
                onValueChange={(value) => setMemberFormData({ ...memberFormData, clerk_user_id: value })}
              >
                <SelectTrigger id="clerk_user_id">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableUsers(selectedCommittee?.id || 0).map((user) => {
                    const displayName = user.name || 
                      (user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.emailAddresses?.[0]?.emailAddress || 
                          user.email || 
                          user.id);
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {getAvailableUsers(selectedCommittee?.id || 0).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No available users. All committee users are already assigned to this committee.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={memberFormData.role}
                onValueChange={(value) => setMemberFormData({ ...memberFormData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="chair">Chair</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={saving || !memberFormData.clerk_user_id}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

