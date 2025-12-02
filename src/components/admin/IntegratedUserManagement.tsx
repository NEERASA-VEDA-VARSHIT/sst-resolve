"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Users, Mail, Shield, UserCheck, UserX, Loader2, Building2, GraduationCap, MapPin, Settings, MessageSquare, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Roles } from "@/types/globals";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      super_admin: 0,
      committee: 0,
      total: users.length,
    };
    users.forEach((user) => {
      const role = user.publicMetadata?.role || "student";
      stats[role as keyof typeof stats]++;
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
      // If already selected, deselect (show all)
      setRoleFilter("all");
    } else {
      setRoleFilter(role);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards - Clickable Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card 
          className={`border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${
            roleFilter === "all" 
              ? "border-primary shadow-md bg-primary/5 dark:bg-primary/10" 
              : "hover:border-primary/50"
          }`}
          onClick={() => handleRoleFilterClick("all")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{roleStats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <User className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-2 transition-all duration-300 cursor-pointer ${
            roleFilter === "student"
              ? "border-blue-400 dark:border-blue-600 bg-blue-100 dark:bg-blue-900/40 shadow-md"
              : "border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700"
          }`}
          onClick={() => handleRoleFilterClick("student")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Students</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{roleStats.student}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-2 transition-all duration-300 cursor-pointer ${
            roleFilter === "admin"
              ? "border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 shadow-md"
              : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700"
          }`}
          onClick={() => handleRoleFilterClick("admin")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Admins</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{roleStats.admin}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-2 transition-all duration-300 cursor-pointer ${
            roleFilter === "super_admin"
              ? "border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/40 shadow-md"
              : "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700"
          }`}
          onClick={() => handleRoleFilterClick("super_admin")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Super Admins</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{roleStats.super_admin}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`border-2 transition-all duration-300 cursor-pointer ${
            roleFilter === "committee"
              ? "border-purple-400 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-md"
              : "border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700"
          }`}
          onClick={() => handleRoleFilterClick("committee")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Committee</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{roleStats.committee}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            User & Staff Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="committee">Committee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Slack ID</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <UserX className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <p className="text-lg font-semibold text-muted-foreground">No users found</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const currentRole = user.publicMetadata?.role || "student";
                    const fullName = user.name || "No name";
                    const email = user.emailAddresses[0]?.emailAddress || "No email";
                    const staffAssignment = getStaffAssignment(user.id);
                    const DomainIcon = staffAssignment ? getDomainIcon(staffAssignment.domain) : null;

                    return (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-primary/10">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            {fullName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(currentRole)} className={getRoleBadgeClass(currentRole)}>
                            {currentRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {staffAssignment ? (
                            <Badge variant="outline" className={getDomainColor(staffAssignment.domain)}>
                              {DomainIcon && <DomainIcon className="w-3 h-3 mr-1" />}
                              {staffAssignment.domain}
                            </Badge>
                          ) : (currentRole === "admin" || currentRole === "super_admin") ? (
                            <Badge variant="outline" className="border-orange-300 text-orange-600 dark:text-orange-400">
                              No Assignment
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {staffAssignment?.scope ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <MapPin className="w-3 h-3" />
                              {staffAssignment.scope}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {staffAssignment?.slackUserId ? (
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs font-mono text-muted-foreground">
                                {staffAssignment.slackUserId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {staffAssignment?.whatsappNumber ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {staffAssignment.whatsappNumber}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant={currentRole === "student" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleSetRole(user.id, "student")}
                              disabled={loading === `${user.id}-student` || currentRole === "student"}
                              className={currentRole === "student" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                            >
                              {loading === `${user.id}-student` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "S"
                              )}
                            </Button>
                            <Button
                              variant={currentRole === "admin" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleSetRole(user.id, "admin")}
                              disabled={loading === `${user.id}-admin` || currentRole === "admin"}
                              className={currentRole === "admin" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                            >
                              {loading === `${user.id}-admin` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "A"
                              )}
                            </Button>
                            <Button
                              variant={currentRole === "super_admin" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleSetRole(user.id, "super_admin")}
                              disabled={loading === `${user.id}-super_admin` || currentRole === "super_admin"}
                              className={currentRole === "super_admin" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                            >
                              {loading === `${user.id}-super_admin` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "SA"
                              )}
                            </Button>
                            <Button
                              variant={currentRole === "committee" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleSetRole(user.id, "committee")}
                              disabled={loading === `${user.id}-committee` || currentRole === "committee"}
                              className={currentRole === "committee" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                            >
                              {loading === `${user.id}-committee` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "C"
                              )}
                            </Button>
                            {(currentRole === "admin" || currentRole === "super_admin") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenStaffDialog(user)}
                                  className="text-primary hover:bg-primary/10"
                                  title="Configure Staff Assignment"
                                >
                                  <Settings className="w-3 h-3" />
                                </Button>
                                {staffAssignment && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteStaff(staffAssignment.id.toString())}
                                    disabled={loading === `delete-${staffAssignment.id}`}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Remove Staff Assignment"
                                  >
                                    {loading === `delete-${staffAssignment.id}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </Button>
                                )}
                              </>
                            )}
                            {currentRole !== "student" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRole(user.id)}
                                disabled={loading === `${user.id}-remove`}
                                className="text-destructive hover:text-destructive"
                                title="Remove Role"
                              >
                                {loading === `${user.id}-remove` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserX className="w-3 h-3" />
                                )}
                              </Button>
                            )}
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

      {/* Staff Assignment Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editingStaff 
                ? `Update staff assignment for ${editingStaff.fullName}`
                : formMode === "select"
                ? "Select an existing user from Clerk to assign as staff"
                : "Create a new user account and assign them as staff. They will need to sign up with Clerk using this email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              </div>
            )}
            {editingStaff && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Editing: {editingStaff.fullName}
                </p>
                {editingStaff.email && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{editingStaff.email}</p>
                )}
              </div>
            )}
            {formMode === "select" && !editingStaff && (
              <div className="space-y-2">
                <Label htmlFor="clerkUserId">Select User *</Label>
                <Select
                  value={staffFormData.clerkUserId || undefined}
                  onValueChange={(value) => {
                    setStaffFormData({ ...staffFormData, clerkUserId: value === "none" ? "" : value });
                    setErrors({ ...errors, clerkUserId: "" });
                    const selectedUser = clerkUsers.find(u => u.id === value);
                    if (selectedUser) {
                      setSelectedUserForStaff({
                        id: selectedUser.id,
                        name: selectedUser.name || (selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : null),
                        emailAddresses: selectedUser.emailAddresses || (selectedUser.email ? [{ emailAddress: selectedUser.email }] : []),
                        publicMetadata: {},
                      });
                    }
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
                {selectedUserForStaff && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <p className="text-sm font-medium">{selectedUserForStaff.name || "No name"}</p>
                    {selectedUserForStaff.emailAddresses[0]?.emailAddress && (
                      <p className="text-xs text-muted-foreground">{selectedUserForStaff.emailAddresses[0].emailAddress}</p>
                    )}
                  </div>
                )}
                {errors.clerkUserId && (
                  <p className="text-sm text-destructive">{errors.clerkUserId}</p>
                )}
              </div>
            )}
            {formMode === "create" && !editingStaff && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={staffFormData.firstName}
                      onChange={(e) => {
                        setStaffFormData({ ...staffFormData, firstName: e.target.value });
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
                      value={staffFormData.lastName}
                      onChange={(e) => {
                        setStaffFormData({ ...staffFormData, lastName: e.target.value });
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
                    value={staffFormData.email}
                    onChange={(e) => {
                      setStaffFormData({ ...staffFormData, email: e.target.value });
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
                <Label htmlFor="domain">Domain *</Label>
                <Select
                  value={staffFormData.domain || undefined}
                  onValueChange={(value) => {
                    setStaffFormData({
                      ...staffFormData,
                      domain: value,
                      scope: value === "College" ? "" : (staffFormData.scope || ""),
                    });
                  }}
                  required
                >
                  <SelectTrigger id="domain">
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
              </div>
              {staffFormData.domain === "Hostel" && (
                <div className="space-y-2">
                  <Label htmlFor="scope">Scope (Hostel/Location) *</Label>
                  <Select
                    value={staffFormData.scope || undefined}
                    onValueChange={(value) => setStaffFormData({ ...staffFormData, scope: value })}
                    required
                    disabled={!masterData || (masterData.scopes.length === 0 && masterData.hostels.length === 0)}
                  >
                    <SelectTrigger id="scope">
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
                      📍 {masterData.scopes.length} location{masterData.scopes.length !== 1 ? 's' : ''} from staff data
                      {masterData.hostels.length > 0 && ` + ${masterData.hostels.length} from hostels table`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Staff Role *</Label>
              <Select
                value={staffFormData.role || undefined}
                onValueChange={(value) => setStaffFormData({ ...staffFormData, role: value })}
                required
                disabled={!masterData || masterData.roles.length === 0}
              >
                <SelectTrigger id="role">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slackUserId">Slack User ID</Label>
                <Input
                  id="slackUserId"
                  value={staffFormData.slackUserId}
                  onChange={(e) => setStaffFormData({ ...staffFormData, slackUserId: e.target.value })}
                  placeholder="U0123ABCD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                <Input
                  id="whatsappNumber"
                  value={staffFormData.whatsappNumber}
                  onChange={(e) => setStaffFormData({ ...staffFormData, whatsappNumber: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStaffDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStaff} disabled={savingStaff}>
              {savingStaff ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

