"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, GraduationCap, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { StaffFilters } from "./StaffFilters";
import { StaffTable } from "./StaffTable";
import { StaffForm } from "./StaffForm";

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
  scopes: Array<{ value: string; label: string }>;
}

interface StaffManagementProps {
  initialStaff: StaffMember[];
  initialMasterData: MasterData;
}

export function StaffManagement({ initialStaff, initialMasterData }: StaffManagementProps) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [masterData] = useState<MasterData>(initialMasterData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"select" | "create">("select");
  const [formData, setFormData] = useState({
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClerkUsers();
  }, []);

  const fetchClerkUsers = async () => {
    try {
      const response = await fetch("/api/admin/list");
      if (response.ok) {
        const data = await response.json();
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

  const refreshData = () => {
    router.refresh();
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
    setErrors({});

    const newErrors: Record<string, string> = {};

    if (formMode === "select" && !editingStaff) {
      if (!formData.clerkUserId || formData.clerkUserId === "none") {
        newErrors.clerkUserId = "Please select a user";
      }
    } else if (formMode === "create") {
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

    if (!formData.domain) {
      newErrors.domain = "Please select a domain";
    }

    if (!formData.scope || !formData.scope.trim()) {
      newErrors.scope = "Please select a scope";
    }

    if (!formData.role) {
      newErrors.role = "Please select a role";
    }

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
        refreshData();
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

  const selectedUser = clerkUsers.find(u => u.id === formData.clerkUserId);
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
        refreshData();
      } else {
        const error = await response.json();
        if (response.status === 409 && error.message) {
          toast.error(error.message, { duration: 6000 });
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

  // Debounced search for client-side filtering (no API calls needed)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      setDebouncedSearchQuery(value);
    },
    300 // Wait 300ms after user stops typing
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const filteredStaff = staff.filter((member) => {
    const matchesSearch = !debouncedSearchQuery || 
      member.fullName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      member.slackUserId?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      member.whatsappNumber?.includes(debouncedSearchQuery);
    
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const matchesDomain = domainFilter === "all" || member.domain === domainFilter;
    
    return matchesSearch && matchesRole && matchesDomain;
  });

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
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      <StaffForm
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            editingStaff={editingStaff}
            formMode={formMode}
            onFormModeChange={setFormMode}
            formData={formData}
            onFormDataChange={(data) => {
              setFormData(prev => ({ ...prev, ...data }));
              setErrors(prev => {
                const newErrors = { ...prev };
                Object.keys(data).forEach(key => {
                  if (newErrors[key]) delete newErrors[key];
                });
                return newErrors;
              });
            }}
            clerkUsers={clerkUsers}
            staff={staff}
            masterData={masterData}
            errors={errors}
            saving={saving}
            onSubmit={handleSubmit}
            onClose={handleCloseDialog}
            selectedUserFullName={selectedUserFullName}
            selectedUserEmail={selectedUserEmail}
          />

      <StaffFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        domainFilter={domainFilter}
        onDomainFilterChange={setDomainFilter}
        masterData={masterData}
      />

      <StaffTable
        staff={filteredStaff}
        loading={loading}
        getDomainIcon={getDomainIcon}
        getDomainColor={getDomainColor}
        onEdit={handleOpenDialog}
        onDelete={(memberId) => {
          setDeletingStaffId(memberId);
          setIsDeleteDialogOpen(true);
        }}
        isDeleteDialogOpen={isDeleteDialogOpen}
        deletingStaffId={deletingStaffId}
        onDeleteDialogChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeletingStaffId(null);
        }}
        onConfirmDelete={handleDelete}
        onAddNew={() => handleOpenDialog()}
      />
    </div>
  );
}
