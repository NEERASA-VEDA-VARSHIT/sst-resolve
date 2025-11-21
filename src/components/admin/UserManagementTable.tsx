"use client";

import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Pencil,
    Shield,
    User,
    UserCog,
    Loader2,
    Search,
    Users,
    UserCheck,
    UserX
} from "lucide-react";
import { toast } from "sonner";

interface UserData {
    id: string;
    clerk_id: string;
    email: string | null;
    full_name: string | null;
    role_id: number | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface Role {
    id: number;
    name: string;
    description: string | null;
}

interface UserManagementTableProps {
    users: UserData[];
    roles: Role[];
}

export function UserManagementTable({ users, roles }: UserManagementTableProps) {
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");

    const getRoleName = (roleId: number | null) => {
        if (!roleId) return "No Role";
        const role = roles.find((r) => r.id === roleId);
        return role?.name || "Unknown";
    };

    const getRoleBadgeVariant = (roleName: string) => {
        switch (roleName.toLowerCase()) {
            case "super_admin":
                return "destructive";
            case "admin":
                return "default";
            case "student":
                return "secondary";
            default:
                return "outline";
        }
    };

    const getRoleBadgeClass = (roleName: string) => {
        switch (roleName.toLowerCase()) {
            case "super_admin":
                return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
            case "admin":
                return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
            case "student":
                return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
            default:
                return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800";
        }
    };

    // Filter and search users
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const fullName = (user.full_name || "").toLowerCase();
            const email = (user.email || "").toLowerCase();
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || fullName.includes(searchLower) || email.includes(searchLower);

            const currentRole = getRoleName(user.role_id).toLowerCase();
            const matchesRole = roleFilter === "all" || currentRole === roleFilter.toLowerCase();

            return matchesSearch && matchesRole;
        });
    }, [users, searchQuery, roleFilter, roles]);

    // Role statistics
    const roleStats = useMemo(() => {
        const stats: Record<string, number> = {
            total: users.length,
        };

        roles.forEach(role => {
            stats[role.name] = users.filter(u => u.role_id === role.id).length;
        });

        return stats;
    }, [users, roles]);

    const handleRoleChange = async (userId: string, newRoleId: string) => {
        setUpdatingUserId(userId);
        try {
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role_id: parseInt(newRoleId) }),
            });

            if (response.ok) {
                toast.success("User role updated successfully");
                // Refresh the page to show updated data
                window.location.reload();
            } else {
                const error = await response.json();
                toast.error(error.error || "Failed to update user role");
            }
        } catch (error) {
            console.error("Error updating user role:", error);
            toast.error("Failed to update user role");
        } finally {
            setUpdatingUserId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-2 hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Total Users</p>
                                <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                    {roleStats.total}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-primary/10">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {roles.map((role) => {
                    const count = roleStats[role.name] || 0;
                    const Icon = role.name === "super_admin" ? Shield : role.name === "admin" ? UserCog : UserCheck;
                    const colorClass = role.name === "super_admin"
                        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                        : role.name === "admin"
                            ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
                            : "border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20";
                    const textColor = role.name === "super_admin"
                        ? "text-red-600 dark:text-red-400"
                        : role.name === "admin"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-blue-600 dark:text-blue-400";
                    const bgColor = role.name === "super_admin"
                        ? "bg-red-100 dark:bg-red-900/30"
                        : role.name === "admin"
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-blue-100 dark:bg-blue-900/30";

                    return (
                        <Card key={role.id} className={`border-2 ${colorClass} hover:shadow-lg transition-all duration-300`}>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">
                                            {role.name.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}s
                                        </p>
                                        <p className={`text-3xl font-bold ${textColor}`}>{count}</p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${bgColor}`}>
                                        <Icon className={`w-6 h-6 ${textColor}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Search and Filters */}
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
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                                {role.name.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Current Role</TableHead>
                            <TableHead>Change Role</TableHead>
                            <TableHead>Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12">
                                    <UserX className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                                    <p className="text-lg font-semibold text-muted-foreground">No users found</p>
                                    <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => {
                                const roleName = getRoleName(user.role_id);
                                return (
                                    <TableRow key={user.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="font-medium">
                                                        {user.full_name || "Unknown User"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        ID: {user.id.substring(0, 8)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{user.email || "No email"}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getRoleBadgeVariant(roleName) as any} className={getRoleBadgeClass(roleName)}>
                                                {roleName.replace("_", " ").toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={user.role_id?.toString() || ""}
                                                onValueChange={(value) => handleRoleChange(user.id, value)}
                                                disabled={updatingUserId === user.id}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles.map((role) => (
                                                        <SelectItem key={role.id} value={role.id.toString()}>
                                                            <div className="flex items-center gap-2">
                                                                {role.name === "super_admin" && (
                                                                    <Shield className="h-3 w-3" />
                                                                )}
                                                                {role.name === "admin" && (
                                                                    <UserCog className="h-3 w-3" />
                                                                )}
                                                                {role.name === "student" && (
                                                                    <User className="h-3 w-3" />
                                                                )}
                                                                <span>{role.name.replace("_", " ")}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {updatingUserId === user.id && (
                                                <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-muted-foreground">
                                                {user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString()
                                                    : "Unknown"}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Results count */}
            {filteredUsers.length > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                    Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}
