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
  id: string;
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

interface MasterData {
  hostels: Array<{ id: number; name: string; code: string | null }>;
  batches: Array<{ id: number; batch_year: number; display_name: string | null }>;
  class_sections: Array<{ id: number; name: string }>;
  domains: Array<{ value: string; label: string }>;
  roles: Array<{ value: string; label: string; description: string | null }>;
  scopes: Array<{ value: string; label: string }>; // Dynamic scopes from staff data
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clerkUserId: "",
    domain: "",
    scope: "",
    role: "admin",
    slackUserId: "",
    whatsappNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStaff();
    fetchClerkUsers();
    fetchMasterData();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      } else {
        console.error("Failed to fetch staff:", response.status, response.statusText);
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
        // Deduplicate users by ID (in case API returns duplicates)
        const uniqueUsers = (data.admins || []).reduce((acc: ClerkUser[], user: ClerkUser) => {
          if (!acc.find(u => u.id === user.id)) {
            acc.push(user);
          }
          return acc;
        }, []);
        setClerkUsers(uniqueUsers);
      }
    } catch (error) {
      console.error("Error fetching Clerk users:", error);
    }
  };

  const fetchMasterData = async () => {
    try {
      setLoadingMasterData(true);
      const response = await fetch("/api/admin/master-data");
      if (response.ok) {
        const data = await response.json();
        // Ensure all required properties exist with default empty arrays
        setMasterData({
          hostels: data.hostels || [],
          batches: data.batches || [],
          class_sections: data.class_sections || [],
          domains: data.domains || [],
          roles: data.roles || [],
          scopes: data.scopes || [],
        });
      } else {
        toast.error("Failed to fetch master data");
        // Set empty master data to prevent crashes
        setMasterData({
          hostels: [],
          batches: [],
          class_sections: [],
          domains: [],
          roles: [],
          scopes: [],
        });
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Failed to fetch master data");
      // Set empty master data to prevent crashes
      setMasterData({
        hostels: [],
        batches: [],
        class_sections: [],
        domains: [],
        roles: [],
        scopes: [],
      });
    } finally {
      setLoadingMasterData(false);
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
    setErrors({});
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

    // Clear previous errors
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.clerkUserId || formData.clerkUserId === "none") {
      newErrors.clerkUserId = "Please select a user";
    }

    if (!formData.domain) {
      newErrors.domain = "Please select a domain";
    }

    if (formData.domain === "Hostel" && !formData.scope) {
      newErrors.scope = "Please select a hostel (scope) for Hostel domain";
    }

    if (formData.domain === "College" && formData.scope) {
      newErrors.scope = "Scope should be empty for College domain";
    }

    if (!formData.role) {
      newErrors.role = "Please select a role";
    }

    if (formData.role && formData.role !== "admin" && formData.role !== "super_admin") {
      newErrors.role = "Role must be 'admin' or 'super_admin'";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the validation errors");
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
        // Show detailed message for foreign key constraint errors
        if (response.status === 409 && error.message) {
          toast.error(error.message, { duration: 6000 }); // Show longer for important messages
        } else {
          toast.error(error.error || "Failed to delete staff member");
        }
        setIsDeleteDialogOpen(false);
        setDeletingStaffId(null);
      }
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast.error("Failed to delete staff member");
      setIsDeleteDialogOpen(false);
      setDeletingStaffId(null);
    }
  };

  const getDomainIcon = (domain: string) => {
    return domain === "Hostel" ? Building2 : GraduationCap;
  };

  const getDomainColor = (domain: string) => {
    return domain === "Hostel" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400";
  };

  // Show loading state only if we haven't loaded master data yet
  // Once master data is loaded (even if empty), show the page
  if (loadingMasterData && !masterData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Loading staff management...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            SPOC Management
          </h1>
          <p className="text-muted-foreground">
            Manage admin assignments to categories and locations. Admins assigned here will automatically receive tickets based on domain and scope.
          </p>
          {masterData && (
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {(masterData.hostels?.length || 0)} Hostel{(masterData.hostels?.length || 0) !== 1 ? 's' : ''} Available
              </Badge>
              <Badge variant="outline" className="text-xs">
                {(masterData.scopes?.length || 0)} Location{(masterData.scopes?.length || 0) !== 1 ? 's' : ''} (From Staff Data)
              </Badge>
              <Badge variant="outline" className="text-xs">
                {(masterData.domains?.length || 0)} Domain{(masterData.domains?.length || 0) !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {(masterData.roles?.length || 0)} Role{(masterData.roles?.length || 0) !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}
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
                  {editingStaff ? "Update staff member details" : "Assign an admin to a domain and location. This determines which tickets they will automatically receive."}
                </DialogDescription>
                {!editingStaff && (
                  <ul className="mt-2 ml-4 list-disc text-sm space-y-1 text-muted-foreground">
                    <li><strong>Domain:</strong> Select the category (Hostel/College)</li>
                    <li><strong>Scope:</strong> For Hostel domain, select specific hostel. For College, no scope needed.</li>
                  </ul>
                )}
              </DialogHeader>
              {loadingMasterData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Loading form data...</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clerkUserId">Select User *</Label>
                    <Select
                      value={formData.clerkUserId || undefined}
                      onValueChange={(value) => {
                        setFormData({ ...formData, clerkUserId: value === "none" ? "" : value });
                        setErrors({ ...errors, clerkUserId: "" });
                      }}
                      required
                    >
                      <SelectTrigger id="clerkUserId" className={errors.clerkUserId ? "border-destructive" : ""}>
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
                          .map((user, index) => {
                            const displayName = user.name ||
                              (user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.emailAddresses?.[0]?.emailAddress ||
                                user.email ||
                                user.id);
                            return (
                              <SelectItem key={`user-${user.id}-${index}`} value={user.id}>
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
                    {errors.clerkUserId && (
                      <p className="text-sm text-destructive">{errors.clerkUserId}</p>
                    )}
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
                          setErrors({ ...errors, domain: "", scope: "" });
                        }}
                        required
                      >
                        <SelectTrigger id="domain" className={errors.domain ? "border-destructive" : ""}>
                          <SelectValue placeholder={masterData ? "Select domain" : "Loading..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {!masterData ? (
                            <SelectItem value="loading" disabled>Loading domains...</SelectItem>
                          ) : masterData.domains.length === 0 ? (
                            <SelectItem value="empty" disabled>No domains available</SelectItem>
                          ) : (
                            masterData.domains.map((domain) => (
                              <SelectItem key={domain.value} value={domain.value}>
                                {domain.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {errors.domain && (
                        <p className="text-sm text-destructive">{errors.domain}</p>
                      )}
                    </div>
                    {formData.domain === "Hostel" && (
                      <div className="space-y-2">
                        <Label htmlFor="scope">Scope (Hostel/Location) *</Label>
                        <Select
                          value={formData.scope}
                          onValueChange={(value) => {
                            setFormData({ ...formData, scope: value });
                            setErrors({ ...errors, scope: "" });
                          }}
                          required
                          disabled={!masterData || (masterData.scopes.length === 0 && masterData.hostels.length === 0)}
                        >
                          <SelectTrigger id="scope" className={errors.scope ? "border-destructive" : ""}>
                            <SelectValue placeholder={masterData ? "Select location/hostel" : "Loading..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {!masterData ? (
                              <SelectItem value="loading" disabled>Loading locations...</SelectItem>
                            ) : masterData.scopes.length === 0 && masterData.hostels.length === 0 ? (
                              <SelectItem value="empty" disabled>No locations available</SelectItem>
                            ) : (
                              <>
                                {/* Show existing scopes from staff data (dynamic) */}
                                {masterData.scopes.length > 0 && (
                                  <>
                                    {masterData.scopes.map((scope) => (
                                      <SelectItem key={`scope-${scope.value}`} value={scope.value}>
                                        {scope.label}
                                      </SelectItem>
                                    ))}
                                    {masterData.hostels.length > 0 && (
                                      <SelectItem value="divider" disabled>
                                        ──── From Hostels Table ────
                                      </SelectItem>
                                    )}
                                  </>
                                )}
                                {/* Also show hostels from hostels table, but only if not already in scopes */}
                                {masterData.hostels
                                  .filter(hostel => !masterData.scopes.some(scope => scope.value === hostel.name))
                                  .map((hostel) => (
                                    <SelectItem key={`hostel-${hostel.id}`} value={hostel.name}>
                                      {hostel.name} {hostel.code ? `(${hostel.code})` : ''}
                                    </SelectItem>
                                  ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {masterData && masterData.scopes.length === 0 && masterData.hostels.length === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ No locations configured. Please add staff with locations or configure hostels first.
                          </p>
                        )}
                        {masterData && masterData.scopes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            📍 Showing {masterData.scopes.length} existing location{masterData.scopes.length !== 1 ? 's' : ''} from staff data
                            {masterData.hostels.length > 0 && ` + ${masterData.hostels.length} from hostels table`}
                          </p>
                        )}
                        {errors.scope && (
                          <p className="text-sm text-destructive">{errors.scope}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData({ ...formData, role: value });
                        setErrors({ ...errors, role: "" });
                      }}
                      required
                      disabled={!masterData || masterData.roles.length === 0}
                    >
                      <SelectTrigger id="role" className={errors.role ? "border-destructive" : ""}>
                        <SelectValue placeholder={masterData ? "Select role" : "Loading..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {!masterData ? (
                          <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                        ) : masterData.roles.length === 0 ? (
                          <SelectItem value="empty" disabled>No roles available</SelectItem>
                        ) : (
                          masterData.roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {masterData && masterData.roles.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ No staff roles configured. Please configure roles in the system.
                      </p>
                    )}
                    {errors.role && (
                      <p className="text-sm text-destructive">{errors.role}</p>
                    )}
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
              )}
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
