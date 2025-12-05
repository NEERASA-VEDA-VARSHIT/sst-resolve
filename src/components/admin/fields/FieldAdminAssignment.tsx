"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Admin {
  id: string;
  name: string;
  email: string;
  domain?: string | null;
  scope?: string | null;
}

interface FieldAdminAssignmentProps {
  inheritFromSubcategory: boolean;
  onInheritChange: (inherit: boolean) => void;
  assignedAdminId: string | null;
  onAssignedAdminChange: (adminId: string | null) => void;
  adminUsers: Admin[];
  loadingStaff: boolean;
  subcategoryDefaultAdmin: string | null;
}

export function FieldAdminAssignment({
  inheritFromSubcategory,
  onInheritChange,
  assignedAdminId,
  onAssignedAdminChange,
  adminUsers,
  loadingStaff,
  subcategoryDefaultAdmin,
}: FieldAdminAssignmentProps) {
  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="inherit_admin_field"
          checked={inheritFromSubcategory}
          onCheckedChange={(checked) => {
            onInheritChange(checked === true);
            if (checked) {
              onAssignedAdminChange(null);
            }
          }}
        />
        <Label htmlFor="inherit_admin_field" className="cursor-pointer font-medium">
          Inherit admin from subcategory
          {subcategoryDefaultAdmin && (
            <span className="text-xs text-muted-foreground ml-2 font-normal">
              (Currently:{" "}
              {adminUsers.find((s) => s.id === subcategoryDefaultAdmin)?.name ||
                adminUsers.find((s) => s.id === subcategoryDefaultAdmin)?.email ||
                "Unknown"}
              )
            </span>
          )}
        </Label>
      </div>
      {!inheritFromSubcategory && (
        <div className="space-y-2 pl-6">
          <Label htmlFor="assigned_admin_id_field">Assign Specific Admin</Label>
          <Select
            value={assignedAdminId || "none"}
            onValueChange={(value) => onAssignedAdminChange(value === "none" ? null : value)}
            disabled={loadingStaff}
          >
            <SelectTrigger id="assigned_admin_id_field">
              <SelectValue placeholder="Select admin (overrides subcategory default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No admin</SelectItem>
              {adminUsers.map((admin) => (
                <SelectItem key={admin.id} value={admin.id}>
                  {admin.name}
                  {admin.domain && ` (${admin.domain}${admin.scope ? ` - ${admin.scope}` : ""})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This admin will override the subcategory default for tickets using this field.
          </p>
        </div>
      )}
    </div>
  );
}
