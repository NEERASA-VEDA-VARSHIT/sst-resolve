"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { Roles } from "@/types/globals";
import { UserFilters } from "./UserFilters";
import { UserManagementTable } from "./UserManagementTable";
import { StaffAssignmentDialog } from "./StaffAssignmentDialog";

type User = {
  id: string;
  name: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata: {
    role?: Roles;
  };
};

interface StaffMember {
  id: number;
  clerkUserId: string | null;
  fullName: string;
  email: string | null;
  role: string;
  domain: string;
  scope: string | null;
  slackUserId: string | null;
  whatsappNumber: string | null;
}

interface MasterData {
  hostels: Array<{ id: number; name: string; code: string | null }>;
  batches: Array<{ id: number; batch_year: number; display_name: string | null }>;
  class_sections: Array<{ id: number; name: string }>;
  domains: Array<{ value: string; label: string }>;
  roles: Array<{ value: string; label: string; description: string | null }>;
  scopes: Array<{ value: string; label: string }>; // Dynamic scopes from staff data
}

export function IntegratedUserManagement({ users }: { users: User[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [, setLoadingMasterData] = useState(true);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [selectedUserForStaff, setSelectedUserForStaff] = useState<User | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formMode, setFormMode] = useState<"select" | "create">("select");
  const [clerkUsers, setClerkUsers] = useState<Array<{ id: string; firstName: string | null; lastName: string | null; emailAddresses?: Array<{ emailAddress: string }>; name?: string; email?: string }>>([]);
  const [staffFormData, setStaffFormData] = useState({
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
  const [savingStaff, setSavingStaff] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStaff();
    fetchMasterData();
    fetchClerkUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClerkUsers = async () => {
    try {
      const response = await fetch("/api/admin/list");
      if (response.ok) {
        const data = await response.json();
        const uniqueUsers = (data.admins || []).reduce((acc: typeof clerkUsers, user: typeof clerkUsers[0]) => {
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

  const fetchStaff = async () => {
    try {
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        // Map API response (snake_case) to component format (camelCase)
        type StaffMemberApiResponse = {
          id: string;
          clerkUserId?: string | null;
          clerk_user_id?: string | null;
          fullName?: string;
          full_name?: string;
          email?: string | null;
          role?: string;
          domain?: string;
          scope?: string | null;
          slackUserId?: string | null;
          slack_user_id?: string | null;
          whatsappNumber?: string | null;
          whatsapp_number?: string | null;
        };
        const mappedStaff = (data.staff || []).map((s: StaffMemberApiResponse) => ({
          id: s.id,
          clerkUserId: s.clerkUserId || s.clerk_user_id || null,
          fullName: s.fullName || s.full_name || "",
          email: s.email || null,
          role: s.role || "",
          domain: s.domain || "",
          scope: s.scope || null,
          slackUserId: s.slackUserId || s.slack_user_id || null,
          whatsappNumber: s.whatsappNumber || s.whatsapp_number || null,
        }));
        setStaff(mappedStaff);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const fetchMasterData = async () => {
    try {
      setLoadingMasterData(true);
      const response = await fetch("/api/admin/master-data");
      if (response.ok) {
        const data = await response.json();
        setMasterData(data);
      } else {
        console.error("Failed to fetch master data");
        toast.error("Failed to load master data");
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Failed to load master data");
    } finally {
      setLoadingMasterData(false);
    }
  };

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = (user.name || "").toLowerCase();
      const email = (user.emailAddresses[0]?.emailAddress || "").toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || fullName.includes(searchLower) || email.includes(searchLower);

      const currentRole = user.publicMetadata?.role || "student";
      const matchesRole = roleFilter === "all" || currentRole === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Role statistics
  const roleStats = useMemo(() => {
    const stats = {
      student: 0,
      admin: 0,
      snr_admin: 0,
      super_admin: 0,
      committee: 0,
      total: users.length,
    };
    users.forEach((user) => {
      const role = user.publicMetadata?.role || "student";
      if (role in stats) {
        stats[role as keyof typeof stats]++;
      }
    });
    return stats;
  }, [users]);

  const getStaffAssignment = (userId: string): StaffMember | null => {
    return staff.find(s => s.clerkUserId === userId) || null;
  };

  const handleSetRole = async (userId: string, role: Roles) => {
    setLoading(`${userId}-${role}`);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      // If setting admin/super_admin, prompt for staff assignment
      if ((role === "admin" || role === "super_admin") && !getStaffAssignment(userId)) {
        const user = users.find(u => u.id === userId);
        if (user) {
          setSelectedUserForStaff(user);
          setStaffFormData(prev => ({
            ...prev,
            clerkUserId: user.id,
            email: user.emailAddresses[0]?.emailAddress || "",
            firstName: "",
            lastName: "",
            domain: "",
            scope: "",
            role: role === "super_admin" ? "super_admin" : "admin",
            slackUserId: "",
            whatsappNumber: "",
          }));
          setIsStaffDialogOpen(true);
        }
      }

      toast.success(`Role updated to ${role}`);
      await fetchStaff();
      window.location.reload();
    } catch (error) {
      console.error("Error setting role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveRole = async (userId: string) => {
    setLoading(`${userId}-remove`);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove role");
      }

      toast.success("Role removed");
      await fetchStaff();
      window.location.reload();
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove role");
    } finally {
      setLoading(null);
    }
  };

  const handleOpenStaffDialog = (user?: User, staffMember?: StaffMember) => {
    if (staffMember) {
      // Editing existing staff member
      setEditingStaff(staffMember);
      setSelectedUserForStaff(null);
      setFormMode("select");
      setStaffFormData({
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
    } else if (user) {
      // Assigning staff to existing user
      const existingStaff = getStaffAssignment(user.id);
      setEditingStaff(null);
      setSelectedUserForStaff(user);
      setFormMode("select");
      if (existingStaff) {
        setStaffFormData({
          clerkUserId: user.id,
          email: user.emailAddresses[0]?.emailAddress || "",
          firstName: "",
          lastName: "",
          domain: existingStaff.domain,
          scope: existingStaff.scope || "",
          role: existingStaff.role,
          slackUserId: existingStaff.slackUserId || "",
          whatsappNumber: existingStaff.whatsappNumber || "",
        });
      } else {
        const userRole = user.publicMetadata?.role || "student";
        setStaffFormData({
          clerkUserId: user.id,
          email: user.emailAddresses[0]?.emailAddress || "",
          firstName: "",
          lastName: "",
          domain: "",
          scope: "",
          role: userRole === "super_admin" ? "super_admin" : "admin",
          slackUserId: "",
          whatsappNumber: "",
        });
      }
    } else {
      // Creating new staff member
      setEditingStaff(null);
      setSelectedUserForStaff(null);
      setFormMode("create");
      setStaffFormData({
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
    setErrors({});
    setIsStaffDialogOpen(true);
  };

  const handleSaveStaff = async () => {
    // Validation
    if (formMode === "select" && !editingStaff && !staffFormData.clerkUserId) {
      setErrors({ clerkUserId: "Please select a user" });
      toast.error("Please select a user");
      return;
    }

    // For select mode, we need either editingStaff or selectedUserForStaff
    if (formMode === "select" && !editingStaff && !selectedUserForStaff) {
      toast.error("Please select a user");
      return;
    }

    if (formMode === "create") {
      if (!staffFormData.email || !staffFormData.firstName || !staffFormData.lastName) {
        setErrors({
          email: !staffFormData.email ? "Email is required" : "",
          firstName: !staffFormData.firstName ? "First name is required" : "",
          lastName: !staffFormData.lastName ? "Last name is required" : "",
        });
        return;
      }
    }

    if (!staffFormData.domain) {
      toast.error("Please select a domain");
      return;
    }

    if (staffFormData.domain === "Hostel" && !staffFormData.scope) {
      toast.error("Please select a scope for Hostel domain");
      return;
    }

    setSavingStaff(true);
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
        domain: staffFormData.domain || null,
        scope: staffFormData.scope || null,
        role: staffFormData.role,
        slackUserId: staffFormData.slackUserId || null,
        whatsappNumber: staffFormData.whatsappNumber || null,
      };

      if (formMode === "select") {
        // For select mode, use clerkUserId from editingStaff or selectedUserForStaff
        if (editingStaff) {
          payload.clerkUserId = editingStaff.clerkUserId;
        } else if (selectedUserForStaff) {
          payload.clerkUserId = selectedUserForStaff.id;
        } else {
          payload.clerkUserId = staffFormData.clerkUserId || null;
        }
      } else {
        // Create new user
        payload.newUser = {
          email: staffFormData.email.trim(),
          firstName: staffFormData.firstName.trim(),
          lastName: staffFormData.lastName.trim(),
          phone: staffFormData.whatsappNumber || null,
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
        setIsStaffDialogOpen(false);
        setSelectedUserForStaff(null);
        setEditingStaff(null);
        setErrors({});
        await fetchStaff();
        window.location.reload(); // Reload to refresh user list
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save staff assignment");
      }
    } catch (error) {
      console.error("Error saving staff:", error);
      toast.error("Failed to save staff assignment");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to remove this staff assignment? The user will be reverted to student role.")) {
      return;
    }

    setLoading(`delete-${staffId}`);
    try {
      const response = await fetch(`/api/admin/staff?id=${staffId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Staff assignment removed");
        await fetchStaff();
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to remove staff assignment");
      }
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast.error("Failed to remove staff assignment");
    } finally {
      setLoading(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "super_admin":
        return "destructive";
      case "snr_admin":
        return "default";
      case "admin":
        return "default";
      case "committee":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
      case "snr_admin":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800";
      case "admin":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
      case "committee":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    }
  };

  const getDomainIcon = (domain: string) => {
    return domain === "Hostel" ? Building2 : GraduationCap;
  };

  const getDomainColor = (domain: string) => {
    return domain === "Hostel" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400";
  };

  const handleRoleFilterClick = (role: string) => {
    if (roleFilter === role) {
      setRoleFilter("all");
    } else {
      setRoleFilter(role);
    }
  };

  const handleStaffFormDataChange = (data: Partial<typeof staffFormData>) => {
    setStaffFormData(prev => ({ ...prev, ...data }));
    setErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(data).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      return newErrors;
    });
  };


  return (
    <div className="space-y-6">
      <UserFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        roleStats={roleStats}
        onRoleFilterClick={handleRoleFilterClick}
      />

      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            User & Staff Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserManagementTable
            users={filteredUsers}
            staff={staff}
            loading={loading}
            getStaffAssignment={getStaffAssignment}
            getRoleBadgeVariant={getRoleBadgeVariant}
            getRoleBadgeClass={getRoleBadgeClass}
            getDomainIcon={getDomainIcon}
            getDomainColor={getDomainColor}
            onSetRole={handleSetRole}
            onRemoveRole={handleRemoveRole}
            onOpenStaffDialog={handleOpenStaffDialog}
            onDeleteStaff={handleDeleteStaff}
          />
        </CardContent>
      </Card>

      <StaffAssignmentDialog
        open={isStaffDialogOpen}
        onOpenChange={setIsStaffDialogOpen}
        editingStaff={editingStaff}
        formMode={formMode}
        onFormModeChange={setFormMode}
        staffFormData={staffFormData}
        onStaffFormDataChange={handleStaffFormDataChange}
        selectedUserForStaff={selectedUserForStaff}
        onSelectedUserChange={setSelectedUserForStaff}
        clerkUsers={clerkUsers}
        staff={staff}
        masterData={masterData}
        errors={errors}
        savingStaff={savingStaff}
        onSave={handleSaveStaff}
      />
    </div>
  );
}

