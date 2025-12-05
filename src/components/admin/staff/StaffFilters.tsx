"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

interface MasterData {
  roles: Array<{ value: string; label: string; description: string | null }>;
  domains: Array<{ value: string; label: string }>;
}

interface StaffFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  domainFilter: string;
  onDomainFilterChange: (value: string) => void;
  masterData: MasterData | null;
}

export function StaffFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  domainFilter,
  onDomainFilterChange,
  masterData,
}: StaffFiltersProps) {
  return (
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
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={roleFilter} onValueChange={onRoleFilterChange}>
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
          <Select value={domainFilter} onValueChange={onDomainFilterChange}>
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
  );
}
