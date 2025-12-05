"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Settings, Trash2, UserX } from "lucide-react";
import type { Roles } from "@/types/globals";

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

interface UserRoleActionsProps {
  userId: string;
  currentRole: string;
  loading: string | null;
  staffAssignment: StaffMember | null;
  onSetRole: (userId: string, role: Roles) => void;
  onRemoveRole: (userId: string) => void;
  onOpenStaffDialog: (userId: string) => void;
  onDeleteStaff: (staffId: string) => void;
}

export function UserRoleActions({
  userId,
  currentRole,
  loading,
  staffAssignment,
  onSetRole,
  onRemoveRole,
  onOpenStaffDialog,
  onDeleteStaff,
}: UserRoleActionsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        variant={currentRole === "student" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSetRole(userId, "student")}
        disabled={loading === `${userId}-student` || currentRole === "student"}
        className={currentRole === "student" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
      >
        {loading === `${userId}-student` ? <Loader2 className="w-3 h-3 animate-spin" /> : "S"}
      </Button>
      <Button
        variant={currentRole === "admin" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSetRole(userId, "admin")}
        disabled={loading === `${userId}-admin` || currentRole === "admin"}
        className={currentRole === "admin" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
      >
        {loading === `${userId}-admin` ? <Loader2 className="w-3 h-3 animate-spin" /> : "A"}
      </Button>
      <Button
        variant={currentRole === "snr_admin" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSetRole(userId, "snr_admin")}
        disabled={loading === `${userId}-snr_admin` || currentRole === "snr_admin"}
        className={currentRole === "snr_admin" ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
        title="Senior Admin (only super_admin can assign)"
      >
        {loading === `${userId}-snr_admin` ? <Loader2 className="w-3 h-3 animate-spin" /> : "SA"}
      </Button>
      <Button
        variant={currentRole === "super_admin" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSetRole(userId, "super_admin")}
        disabled={loading === `${userId}-super_admin` || currentRole === "super_admin"}
        className={currentRole === "super_admin" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
      >
        {loading === `${userId}-super_admin` ? <Loader2 className="w-3 h-3 animate-spin" /> : "SU"}
      </Button>
      <Button
        variant={currentRole === "committee" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSetRole(userId, "committee")}
        disabled={loading === `${userId}-committee` || currentRole === "committee"}
        className={currentRole === "committee" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
      >
        {loading === `${userId}-committee` ? <Loader2 className="w-3 h-3 animate-spin" /> : "C"}
      </Button>
      {(currentRole === "admin" || currentRole === "snr_admin" || currentRole === "super_admin") && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenStaffDialog(userId)}
            className="text-primary hover:bg-primary/10"
            title="Configure Staff Assignment"
          >
            <Settings className="w-3 h-3" />
          </Button>
          {staffAssignment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteStaff(staffAssignment.id.toString())}
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
          onClick={() => onRemoveRole(userId)}
          disabled={loading === `${userId}-remove`}
          className="text-destructive hover:text-destructive"
          title="Remove Role"
        >
          {loading === `${userId}-remove` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <UserX className="w-3 h-3" />
          )}
        </Button>
      )}
    </div>
  );
}
