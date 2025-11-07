"use client";

import { useState, useMemo } from "react";
import { setRole, removeRole } from "@/app/(app)/dashboard/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Users, Mail, Shield, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Roles } from "@/types/globals";

type User = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	emailAddresses: Array<{ emailAddress: string }>;
	publicMetadata: {
		role?: Roles;
	};
};

export function UserManagement({ users }: { users: User[] }) {
	const [loading, setLoading] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");

	// Filter and search users
	const filteredUsers = useMemo(() => {
		return users.filter((user) => {
			const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim().toLowerCase();
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

	const handleSetRole = async (userId: string, role: Roles) => {
		setLoading(`${userId}-${role}`);
		const formData = new FormData();
		formData.append("id", userId);
		formData.append("role", role);
		try {
			await setRole(formData);
			toast.success(`Role updated to ${role}`);
			window.location.reload();
		} catch (error) {
			console.error("Error setting role:", error);
			toast.error("Failed to update role");
		} finally {
			setLoading(null);
		}
	};

	const handleRemoveRole = async (userId: string) => {
		setLoading(`${userId}-remove`);
		const formData = new FormData();
		formData.append("id", userId);
		try {
			await removeRole(formData);
			toast.success("Role removed");
			window.location.reload();
		} catch (error) {
			console.error("Error removing role:", error);
			toast.error("Failed to remove role");
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
						User Management
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
								const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name";
								const email = user.emailAddresses[0]?.emailAddress || "No email";

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
													<div className="flex items-center gap-2 ml-14">
														<Badge variant={getRoleBadgeVariant(currentRole)} className={getRoleBadgeClass(currentRole)}>
															{currentRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
														</Badge>
													</div>
												</div>
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
		</div>
	);
}

