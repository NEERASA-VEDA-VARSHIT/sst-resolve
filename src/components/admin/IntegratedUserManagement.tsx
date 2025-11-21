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
import { Search, User, Users, Mail, Shield, UserCheck, UserX, Loader2, Building2, GraduationCap, MapPin, Settings } from "lucide-react";
import { toast } from "sonner";
import type { Roles } from "@/types/globals";

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
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [selectedUserForStaff, setSelectedUserForStaff] = useState<User | null>(null);
  const [staffFormData, setStaffFormData] = useState({
    domain: "",
    scope: "",
    role: "admin",
    slackUserId: "",
    whatsappNumber: "",
  });
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchMasterData();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        // Map API response (snake_case) to component format (camelCase)
        const mappedStaff = (data.staff || []).map((s: any) => ({
          id: s.id,
          clerkUserId: s.clerk_user_id || null, // Map snake_case to camelCase
          fullName: s.full_name || "",
          email: s.email || null,
          role: s.role || "",
          domain: s.domain || "",
          scope: s.scope || null,
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
          setStaffFormData({
            domain: "",
            scope: "",
            role: role === "super_admin" ? "super_admin" : "admin",
            slackUserId: "",
            whatsappNumber: "",
          });
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

  const handleOpenStaffDialog = (user: User) => {
    const existingStaff = getStaffAssignment(user.id);
    setSelectedUserForStaff(user);
    if (existingStaff) {
      setStaffFormData({
        domain: existingStaff.domain,
        scope: existingStaff.scope || "",
        role: existingStaff.role,
        slackUserId: "",
        whatsappNumber: "",
      });
    } else {
      const userRole = user.publicMetadata?.role || "student";
      setStaffFormData({
        domain: "",
        scope: "",
        role: userRole === "super_admin" ? "super_admin" : "admin",
        slackUserId: "",
        whatsappNumber: "",
      });
    }
    setIsStaffDialogOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!selectedUserForStaff) return;

    if (!staffFormData.domain) {
      toast.error("Please select a domain");
      return;
    }

    if (staffFormData.domain === "Hostel" && !staffFormData.scope) {
      toast.error("Please select a hostel scope");
      return;
    }

    setSavingStaff(true);
    try {
      const existingStaff = getStaffAssignment(selectedUserForStaff.id);
      const payload = {
        clerkUserId: selectedUserForStaff.id,
        domain: staffFormData.domain,
        scope: staffFormData.domain === "College" ? null : (staffFormData.scope || null),
        role: staffFormData.role,
        slackUserId: staffFormData.slackUserId || null,
        whatsappNumber: staffFormData.whatsappNumber || null,
      };

      let response;
      if (existingStaff) {
        response = await fetch("/api/admin/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existingStaff.id, ...payload }),
        });
      } else {
        response = await fetch("/api/admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        toast.success(existingStaff ? "Staff assignment updated" : "Staff assignment created");
        setIsStaffDialogOpen(false);
        setSelectedUserForStaff(null);
        await fetchStaff();
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

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-2 hover:shadow-lg transition-all duration-300 hover:border-primary/50">
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
        <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 hover:shadow-lg transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700">
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
        <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-lg transition-all duration-300 hover:border-amber-300 dark:hover:border-amber-700">
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
        <Card className="border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 hover:shadow-lg transition-all duration-300 hover:border-red-300 dark:hover:border-red-700">
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
        <Card className="border-2 border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 hover:shadow-lg transition-all duration-300 hover:border-purple-300 dark:hover:border-purple-700">
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

          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No users found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const currentRole = user.publicMetadata?.role || "student";
                const fullName = user.name || "No name";
                const email = user.emailAddresses[0]?.emailAddress || "No email";
                const staffAssignment = getStaffAssignment(user.id);
                const DomainIcon = staffAssignment ? getDomainIcon(staffAssignment.domain) : null;

                return (
                  <Card key={user.id} className="border-2 hover:shadow-lg hover:border-primary/50 transition-all duration-300 bg-card">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-lg text-foreground">{fullName}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">{email}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-14 flex-wrap">
                            <Badge variant={getRoleBadgeVariant(currentRole)} className={getRoleBadgeClass(currentRole)}>
                              {currentRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            {staffAssignment && (
                              <>
                                <Badge variant="outline" className={getDomainColor(staffAssignment.domain)}>
                                  {DomainIcon && <DomainIcon className="w-3 h-3 mr-1" />}
                                  {staffAssignment.domain}
                                </Badge>
                                {staffAssignment.scope && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {staffAssignment.scope}
                                  </Badge>
                                )}
                              </>
                            )}
                            {(currentRole === "admin" || currentRole === "super_admin") && !staffAssignment && (
                              <Badge variant="outline" className="border-orange-300 text-orange-600 dark:text-orange-400">
                                No Staff Assignment
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Role Assignment Buttons */}
                        {currentRole === "student" && (
                          <p className="text-xs text-muted-foreground mb-2 italic">
                            💡 Tip: Assigning an elevated role (Admin, Super Admin, Committee) will automatically remove the Student role.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                          <Button
                            variant={currentRole === "student" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetRole(user.id, "student")}
                            disabled={loading === `${user.id}-student` || currentRole === "student"}
                            className={currentRole === "student" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                          >
                            {loading === `${user.id}-student` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Student"
                            )}
                          </Button>
                          <Button
                            variant={currentRole === "admin" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetRole(user.id, "admin")}
                            disabled={loading === `${user.id}-admin` || currentRole === "admin"}
                            className={currentRole === "admin" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                          >
                            {loading === `${user.id}-admin` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Admin"
                            )}
                          </Button>
                          <Button
                            variant={currentRole === "super_admin" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetRole(user.id, "super_admin")}
                            disabled={loading === `${user.id}-super_admin` || currentRole === "super_admin"}
                            className={currentRole === "super_admin" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                          >
                            {loading === `${user.id}-super_admin` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Super Admin"
                            )}
                          </Button>
                          <Button
                            variant={currentRole === "committee" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetRole(user.id, "committee")}
                            disabled={loading === `${user.id}-committee` || currentRole === "committee"}
                            className={currentRole === "committee" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                          >
                            {loading === `${user.id}-committee` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Committee"
                            )}
                          </Button>
                          {(currentRole === "admin" || currentRole === "super_admin") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenStaffDialog(user)}
                              className="border-primary text-primary hover:bg-primary/10"
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Staff
                            </Button>
                          )}
                          {currentRole !== "student" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveRole(user.id)}
                              disabled={loading === `${user.id}-remove`}
                            >
                              {loading === `${user.id}-remove` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserX className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Assignment Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Assignment</DialogTitle>
            <DialogDescription>
              {selectedUserForStaff && `Configure staff assignment for ${selectedUserForStaff.name || ""}`.trim()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain *</Label>
                <Select
                  value={staffFormData.domain}
                  onValueChange={(value) => {
                    setStaffFormData({
                      ...staffFormData,
                      domain: value,
                      scope: value === "College" ? "" : staffFormData.scope,
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
                      masterData.domains.map((domain) => (
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
                    value={staffFormData.scope}
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
                value={staffFormData.role}
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

