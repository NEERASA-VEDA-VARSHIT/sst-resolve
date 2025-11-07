"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Users, Plus, Edit, Trash2, Building2, GraduationCap, MapPin, Loader2, User, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface StaffMember {
  id: number;
  clerkUserId: string | null;
  fullName: string;
  email: string | null;
  slackUserId: string | null;
  whatsappNumber: string | null;
  role: string;
  domain: string;
  scope: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  name?: string;
  email?: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    clerkUserId: "",
    domain: "",
    scope: "",
    role: "admin",
    slackUserId: "",
    whatsappNumber: "",
  });

  useEffect(() => {
    fetchStaff();
    fetchClerkUsers();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      } else {
        toast.error("Failed to fetch staff");
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  const fetchClerkUsers = async () => {
    try {
      const response = await fetch("/api/admin/list");
      if (response.ok) {
        const data = await response.json();
        setClerkUsers(data.admins || []);
      }
    } catch (error) {
      console.error("Error fetching Clerk users:", error);
    }
  };

  const handleOpenDialog = (staffMember?: StaffMember) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        clerkUserId: staffMember.clerkUserId || "",
        domain: staffMember.domain,
        scope: staffMember.scope || "",
        role: staffMember.role,
        slackUserId: staffMember.slackUserId || "",
        whatsappNumber: staffMember.whatsappNumber || "",
      });
    } else {
      setEditingStaff(null);
      setFormData({
        clerkUserId: "",
        domain: "",
        scope: "",
        role: "admin",
        slackUserId: "",
        whatsappNumber: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
    setFormData({
      clerkUserId: "",
      domain: "",
      scope: "",
      role: "admin",
      slackUserId: "",
      whatsappNumber: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clerkUserId || formData.clerkUserId === "none") {
      toast.error("Please select a user");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        clerkUserId: formData.clerkUserId === "none" ? null : formData.clerkUserId,
        scope: formData.domain === "College" ? null : (formData.scope || null),
        slackUserId: formData.slackUserId || null,
        whatsappNumber: formData.whatsappNumber || null,
      };

      let response;
      if (editingStaff) {
        response = await fetch("/api/admin/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingStaff.id, ...payload }),
        });
      } else {
        response = await fetch("/api/admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        toast.success(editingStaff ? "Staff member updated" : "Staff member created");
        handleCloseDialog();
        fetchStaff();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save staff member");
      }
    } catch (error) {
      console.error("Error saving staff:", error);
      toast.error("Failed to save staff member");
    } finally {
      setSaving(false);
    }
  };

  // Get selected user details
  const selectedUser = clerkUsers.find(u => u.id === formData.clerkUserId);
  const selectedUserFullName = selectedUser
    ? `${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim() || "No name"
    : "";
  const selectedUserEmail = selectedUser?.emailAddresses?.[0]?.emailAddress || selectedUser?.email || "";

  const handleDelete = async () => {
    if (!deletingStaffId) return;

    try {
      const response = await fetch(`/api/admin/staff?id=${deletingStaffId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Staff member deleted");
        setIsDeleteDialogOpen(false);
        setDeletingStaffId(null);
        fetchStaff();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete staff member");
      }
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast.error("Failed to delete staff member");
    }
  };

  const getDomainIcon = (domain: string) => {
    return domain === "Hostel" ? Building2 : GraduationCap;
  };

  const getDomainColor = (domain: string) => {
    return domain === "Hostel" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400";
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
            Staff Management
          </h1>
          <p className="text-muted-foreground">
            Manage admin assignments and domain/scope assignments
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
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
                <DialogDescription>
                  {editingStaff ? "Update staff member details" : "Create a new staff member and assign them to a domain/scope"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clerkUserId">Select User *</Label>
                  <Select
                    value={formData.clerkUserId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, clerkUserId: value === "none" ? "" : value })}
                    required
                  >
                    <SelectTrigger id="clerkUserId">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clerkUsers
                        .filter(user => {
                          // When editing, show current user; when creating, exclude users already in staff
                          if (editingStaff && staff.find(s => s.clerkUserId === user.id && s.id !== editingStaff.id)) {
                            return false;
                          }
                          if (!editingStaff && staff.find(s => s.clerkUserId === user.id)) {
                            return false;
                          }
                          return true;
                        })
                        .map((user) => {
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
                  {selectedUser && (
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <p className="text-sm font-medium">{selectedUserFullName}</p>
                      {selectedUserEmail && (
                        <p className="text-xs text-muted-foreground">{selectedUserEmail}</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select a user from Clerk. Their name and email will be automatically used.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain *</Label>
                    <Select
                      value={formData.domain}
                      onValueChange={(value) => {
                        setFormData({
                          ...formData,
                          domain: value,
                          scope: value === "College" ? "" : formData.scope,
                        });
                      }}
                      required
                    >
                      <SelectTrigger id="domain">
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hostel">Hostel</SelectItem>
                        <SelectItem value="College">College</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.domain === "Hostel" && (
                    <div className="space-y-2">
                      <Label htmlFor="scope">Scope (Hostel) *</Label>
                      <Select
                        value={formData.scope}
                        onValueChange={(value) => setFormData({ ...formData, scope: value })}
                        required
                      >
                        <SelectTrigger id="scope">
                          <SelectValue placeholder="Select hostel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Velankani">Velankani</SelectItem>
                          <SelectItem value="Neeladri">Neeladri</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    required
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slackUserId">Slack User ID</Label>
                    <Input
                      id="slackUserId"
                      value={formData.slackUserId}
                      onChange={(e) => setFormData({ ...formData, slackUserId: e.target.value })}
                      placeholder="U0123ABCD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                    <Input
                      id="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
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
                      editingStaff ? "Update" : "Create"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Staff List */}
      <div className="space-y-3">
        {staff.map((member) => {
          const DomainIcon = getDomainIcon(member.domain);
          return (
            <Card key={member.id} className="border-2 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-primary/10`}>
                      <DomainIcon className={`w-5 h-5 ${getDomainColor(member.domain)}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{member.fullName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant={member.role === "super_admin" ? "destructive" : "default"}>
                          {member.role === "super_admin" ? "Super Admin" : "Admin"}
                        </Badge>
                        <Badge variant="outline" className={getDomainColor(member.domain)}>
                          {member.domain}
                        </Badge>
                        {member.scope && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {member.scope}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{member.email}</span>
                  </div>
                )}
                {member.clerkUserId && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-mono text-xs">
                      {member.clerkUserId.slice(0, 8)}...
                    </span>
                  </div>
                )}
                {member.slackUserId && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-mono text-xs">{member.slackUserId}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(member)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeletingStaffId(member.id);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {staff.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-1">No staff members</p>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Add staff members to assign them to domains and scopes
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Staff Member
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the staff member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingStaffId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

