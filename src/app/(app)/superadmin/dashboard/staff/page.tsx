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
import { Users, Plus, Trash2, Building2, GraduationCap, MapPin, Loader2, Mail, Search, MessageSquare, Phone, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

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
  committee: {
    id: number;
    name: string;
    description: string | null;
  } | null;
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
  hostels: Array<{ id: number; name: string }>;
  batches: Array<{ id: number; batch_year: number }>;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"select" | "create">("select"); // "select" existing user or "create" new user
  const [formData, setFormData] = useState({
    clerkUserId: "",
    // For creating new user
    email: "",
    firstName: "",
    lastName: "",
    // Staff assignment
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
      setFormMode("select");
      setFormData({
        clerkUserId: staffMember.clerkUserId || "",
        email: staffMember.email || "",
        firstName: "",
        lastName: "",
        domain: staffMember.domain,
        scope: staffMember.scope || "",
        role: staffMember.role,
        slackUserId: staffMember.slackUserId || "",
        whatsappNumber: staffMember.whatsappNumber || "",
      });
    } else {
      setEditingStaff(null);
      setFormMode("select");
      setFormData({
        clerkUserId: "",
        email: "",
        firstName: "",
        lastName: "",
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
    setFormMode("select");
    setErrors({});
    setFormData({
      clerkUserId: "",
      email: "",
      firstName: "",
      lastName: "",
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

    if (formMode === "select" && !editingStaff) {
      // Only validate user selection when creating, not when editing
      if (!formData.clerkUserId || formData.clerkUserId === "none") {
        newErrors.clerkUserId = "Please select a user";
      }
    } else if (formMode === "create") {
      // Create new user mode
      if (!formData.email || !formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = "Please enter a valid email address";
      }
      if (!formData.firstName?.trim()) {
        newErrors.firstName = "First name is required";
      }
      if (!formData.lastName?.trim()) {
        newErrors.lastName = "Last name is required";
      }
    }

    // Domain is always required
    if (!formData.domain) {
      newErrors.domain = "Please select a domain";
    }

    // Scope is always required
    if (!formData.scope || !formData.scope.trim()) {
      newErrors.scope = "Please select a scope";
    }

    if (!formData.role) {
      newErrors.role = "Please select a role";
    }

    // Validate role exists in master data
    if (formData.role && masterData) {
      const validRole = masterData.roles.find(r => r.value === formData.role);
      if (!validRole) {
        newErrors.role = "Please select a valid role";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the validation errors");
      return;
    }

    setSaving(true);

    try {
      type StaffPayload = {
        domain: string | null;
        scope: string | null;
        role: string;
        slackUserId: string | null;
        whatsappNumber: string | null;
        clerkUserId?: string | null;
        newUser?: {
          email: string;
          firstName: string;
          lastName: string;
          phone: string | null;
        };
      };

      const payload: StaffPayload = {
        domain: formData.domain || null,
        scope: formData.scope || null,
        role: formData.role,
        slackUserId: formData.slackUserId || null,
        whatsappNumber: formData.whatsappNumber || null,
      };

      if (formMode === "select") {
        payload.clerkUserId = formData.clerkUserId === "none" ? null : formData.clerkUserId;
      } else {
        // Create new user
        payload.newUser = {
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.whatsappNumber || null,
        };
      }

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
  // When editing, use staff member's info if user not found in clerkUsers
  const selectedUserFullName = editingStaff && !selectedUser
    ? editingStaff.fullName
    : selectedUser
    ? `${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim() || "No name"
    : "";
  const selectedUserEmail = editingStaff && !selectedUser
    ? editingStaff.email || ""
    : selectedUser?.emailAddresses?.[0]?.emailAddress || selectedUser?.email || "";

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

  // Filter staff based on search and filters
  const filteredStaff = staff.filter((member) => {
    const matchesSearch = !searchQuery || 
      member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.slackUserId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.whatsappNumber?.includes(searchQuery);
    
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const matchesDomain = domainFilter === "all" || member.domain === domainFilter;
    
    return matchesSearch && matchesRole && matchesDomain;
  });

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
                  {editingStaff ? "Update staff member details" : "Assign an admin to a domain and location. This determines which tickets they will automatically receive. Note: Domain and scope are optional for Super Admin."}
                </DialogDescription>
                {!editingStaff && (
                  <ul className="mt-2 ml-4 list-disc text-sm space-y-1 text-muted-foreground">
                    <li><strong>Domain:</strong> Select the category (Hostel/College). Optional for Super Admin.</li>
                    <li><strong>Scope:</strong> For Hostel domain, select specific hostel. For College, no scope needed. Optional for Super Admin.</li>
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
                  {!editingStaff && (
                    <div className="space-y-2">
                      <Label>User Selection Mode</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={formMode === "select" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormMode("select")}
                        >
                          Select Existing User
                        </Button>
                        <Button
                          type="button"
                          variant={formMode === "create" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormMode("create")}
                        >
                          Create New User
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formMode === "select" 
                          ? "Select an existing user from Clerk to assign as staff."
                          : "Create a new user account and assign them as staff. They will need to sign up with Clerk using this email."}
                      </p>
                    </div>
                  )}
                  {editingStaff && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Editing: {editingStaff.fullName}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        You can update domain, scope, role, and contact information. User cannot be changed.
                      </p>
                    </div>
                  )}

                  {formMode === "select" ? (
                    <div className="space-y-2">
                      <Label htmlFor="clerkUserId">Select User *</Label>
                      {editingStaff ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-muted rounded-lg space-y-1 border">
                            <p className="text-sm font-medium">{editingStaff.fullName}</p>
                            {editingStaff.email && (
                              <p className="text-xs text-muted-foreground">{editingStaff.email}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            User cannot be changed when editing. To change the user, delete and recreate the staff member.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Select
                            value={formData.clerkUserId || undefined}
                            onValueChange={(value) => {
                              setFormData({ ...formData, clerkUserId: value === "none" ? "" : value });
                              setErrors({ ...errors, clerkUserId: "" });
                            }}
                            required={formMode === "select"}
                          >
                            <SelectTrigger id="clerkUserId" className={errors.clerkUserId ? "border-destructive" : ""}>
                              <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {clerkUsers
                                .filter(user => {
                                  // When creating, exclude users already in staff
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
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => {
                              setFormData({ ...formData, firstName: e.target.value });
                              setErrors({ ...errors, firstName: "" });
                            }}
                            placeholder="John"
                            className={errors.firstName ? "border-destructive" : ""}
                            required={formMode === "create"}
                          />
                          {errors.firstName && (
                            <p className="text-sm text-destructive">{errors.firstName}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => {
                              setFormData({ ...formData, lastName: e.target.value });
                              setErrors({ ...errors, lastName: "" });
                            }}
                            placeholder="Doe"
                            className={errors.lastName ? "border-destructive" : ""}
                            required={formMode === "create"}
                          />
                          {errors.lastName && (
                            <p className="text-sm text-destructive">{errors.lastName}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            setErrors({ ...errors, email: "" });
                          }}
                          onBlur={(e) => {
                            const email = e.target.value.trim();
                            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                              setErrors({ ...errors, email: "Please enter a valid email address" });
                            }
                          }}
                          placeholder="john.doe@example.com"
                          className={errors.email ? "border-destructive" : ""}
                          required={formMode === "create"}
                        />
                        <p className="text-xs text-muted-foreground">
                          User must sign up with Clerk using this email address.
                        </p>
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain">
                        Domain <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.domain}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            domain: value,
                          });
                          setErrors({ ...errors, domain: "" });
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
                            masterData.domains
                              .filter(domain => domain.value && domain.value.trim() !== "")
                              .map((domain) => (
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
                    <div className="space-y-2">
                      <Label htmlFor="scope">
                        Scope (Hostel/Location) <span className="text-red-500">*</span>
                      </Label>
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
                                    {masterData.scopes
                                      .filter(scope => scope.value && scope.value.trim() !== "")
                                      .map((scope) => (
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
                                  .filter(hostel => hostel.name && hostel.name.trim() !== "" && !masterData.scopes.some(scope => scope.value === hostel.name))
                                  .map((hostel) => (
                                    <SelectItem key={`hostel-${hostel.id}`} value={hostel.name}>
                                      {hostel.name}
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData({ 
                          ...formData, 
                          role: value,
                        });
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
                          masterData.roles
                            .filter(role => role.value && role.value.trim() !== "")
                            .map((role) => (
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

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name, email, Slack ID, committee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {masterData?.roles
                  .filter(role => role.value && role.value.trim() !== "")
                  .map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {masterData?.domains.map((domain) => (
                  <SelectItem key={domain.value} value={domain.value}>
                    {domain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members ({filteredStaff.length})</CardTitle>
          <CardDescription>
            All admin and super admin profiles managed by the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead>Slack ID</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {staff.length === 0 ? (
                        <>
                          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-semibold mb-1">No staff members</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Add staff members to assign them to domains and scopes
                          </p>
                          <Button onClick={() => handleOpenDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Staff Member
                          </Button>
                        </>
                      ) : (
                        <p className="text-muted-foreground">No staff members match your filters</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((member) => {
                    const DomainIcon = getDomainIcon(member.domain);
                    return (
                      <TableRow key={member.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded bg-primary/10`}>
                              <DomainIcon className={`w-4 h-4 ${getDomainColor(member.domain)}`} />
                            </div>
                            {member.fullName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {member.email || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            member.role === "super_admin" ? "destructive" : 
                            member.role === "committee" ? "secondary" : 
                            "default"
                          }>
                            {member.role === "super_admin" ? "Super Admin" : 
                             member.role === "committee" ? "Committee" : 
                             "Admin"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getDomainColor(member.domain)}>
                            {member.domain || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.scope ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <MapPin className="w-3 h-3" />
                              {member.scope}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.committee ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                              <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              {member.committee.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.slackUserId ? (
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs font-mono text-muted-foreground">
                                {member.slackUserId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.whatsappNumber ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {member.whatsappNumber}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(member)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingStaffId(member.id);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
