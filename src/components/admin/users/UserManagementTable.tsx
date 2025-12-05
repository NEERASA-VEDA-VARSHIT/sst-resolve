"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User, Mail, Building2, GraduationCap, MapPin, MessageSquare, Phone, UserX } from "lucide-react";
import { UserRoleActions } from "./UserRoleActions";
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
  slackUserId: string | null;
  whatsappNumber: string | null;
}

interface UserManagementTableProps {
  users: User[];
  loading: string | null;
  getStaffAssignment: (userId: string) => StaffMember | null;
  getRoleBadgeVariant: (role: string) => "default" | "destructive" | "secondary" | "outline";
  getRoleBadgeClass: (role: string) => string;
  getDomainIcon: (domain: string) => typeof Building2 | typeof GraduationCap;
  getDomainColor: (domain: string) => string;
  onSetRole: (userId: string, role: Roles) => void;
  onRemoveRole: (userId: string) => void;
  onOpenStaffDialog: (user: User) => void;
  onDeleteStaff: (staffId: string) => void;
}

export function UserManagementTable({
  users,
  loading,
  getStaffAssignment,
  getRoleBadgeVariant,
  getRoleBadgeClass,
  getDomainIcon,
  getDomainColor,
  onSetRole,
  onRemoveRole,
  onOpenStaffDialog,
  onDeleteStaff,
}: UserManagementTableProps) {
  if (users.length === 0) {
    return (
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
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <UserX className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-lg font-semibold text-muted-foreground">No users found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
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
          {users.map((user) => {
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
                  <UserRoleActions
                    userId={user.id}
                    currentRole={currentRole}
                    loading={loading}
                    staffAssignment={staffAssignment}
                    onSetRole={onSetRole}
                    onRemoveRole={onRemoveRole}
                    onOpenStaffDialog={() => onOpenStaffDialog(user)}
                    onDeleteStaff={onDeleteStaff}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
