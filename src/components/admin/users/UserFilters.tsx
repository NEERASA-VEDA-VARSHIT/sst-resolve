"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Users, Shield, UserCheck } from "lucide-react";

interface UserFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  roleStats: {
    total: number;
    student: number;
    admin: number;
    snr_admin: number;
    super_admin: number;
    committee: number;
  };
  onRoleFilterClick: (role: string) => void;
}

export function UserFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  roleStats,
  onRoleFilterClick,
}: UserFiltersProps) {
  return (
    <>
      {/* Statistics Cards - Clickable Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card
          className={`border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${
            roleFilter === "all"
              ? "border-primary shadow-md bg-primary/5 dark:bg-primary/10"
              : "hover:border-primary/50"
          }`}
          onClick={() => onRoleFilterClick("all")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {roleStats.total}
                </p>
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
          onClick={() => onRoleFilterClick("student")}
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
          onClick={() => onRoleFilterClick("admin")}
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
            roleFilter === "snr_admin"
              ? "border-orange-400 dark:border-orange-600 bg-orange-100 dark:bg-orange-900/40 shadow-md"
              : "border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-700"
          }`}
          onClick={() => onRoleFilterClick("snr_admin")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Senior Admins</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{roleStats.snr_admin}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
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
          onClick={() => onRoleFilterClick("super_admin")}
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
          onClick={() => onRoleFilterClick("committee")}
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="snr_admin">Senior Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="committee">Committee</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
