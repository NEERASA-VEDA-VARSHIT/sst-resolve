"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, GraduationCap, Mail, MapPin, MessageSquare, Phone, Users, Plus } from "lucide-react";
import { StaffActions } from "./StaffActions";
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

interface StaffTableProps {
  staff: StaffMember[];
  loading: boolean;
  getDomainIcon: (domain: string) => typeof Building2 | typeof GraduationCap;
  getDomainColor: (domain: string) => string;
  onEdit: (member: StaffMember) => void;
  onDelete: (memberId: string) => void;
  isDeleteDialogOpen: boolean;
  deletingStaffId: string | null;
  onDeleteDialogChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onAddNew: () => void;
}

export function StaffTable({
  staff,
  loading,
  getDomainIcon,
  getDomainColor,
  onEdit,
  onDelete,
  isDeleteDialogOpen,
  deletingStaffId,
  onDeleteDialogChange,
  onConfirmDelete,
  onAddNew,
}: StaffTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Members ({staff.length})</CardTitle>
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
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-semibold mb-1">No staff members</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add staff members to assign them to domains and scopes
                    </p>
                    <Button onClick={onAddNew}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Staff Member
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => {
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
                          member.role === "snr_admin" ? "default" : 
                          member.role === "committee" ? "secondary" : 
                          "default"
                        }>
                          {member.role === "super_admin" ? "Super Admin" : 
                           member.role === "snr_admin" ? "Senior Admin" : 
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
                        <StaffActions
                          onEdit={() => onEdit(member)}
                          onDelete={() => onDelete(member.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the staff member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
