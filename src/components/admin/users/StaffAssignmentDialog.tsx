"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

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
  scopes: Array<{ value: string; label: string }>;
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  name?: string;
  email?: string;
}

type User = {
  id: string;
  name: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata: {
    role?: string;
  };
};

interface StaffAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStaff: StaffMember | null;
  formMode: "select" | "create";
  onFormModeChange: (mode: "select" | "create") => void;
  staffFormData: {
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    domain: string;
    scope: string;
    role: string;
    slackUserId: string;
    whatsappNumber: string;
  };
  onStaffFormDataChange: (data: Partial<{
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    domain: string;
    scope: string;
    role: string;
    slackUserId: string;
    whatsappNumber: string;
  }>) => void;
  selectedUserForStaff: User | null;
  onSelectedUserChange: (user: User | null) => void;
  clerkUsers: ClerkUser[];
  staff: StaffMember[];
  masterData: MasterData | null;
  errors: Record<string, string>;
  savingStaff: boolean;
  onSave: () => void;
}

export function StaffAssignmentDialog({
  open,
  onOpenChange,
  editingStaff,
  formMode,
  onFormModeChange,
  staffFormData,
  onStaffFormDataChange,
  selectedUserForStaff,
  onSelectedUserChange,
  clerkUsers,
  staff,
  masterData,
  errors,
  savingStaff,
  onSave,
}: StaffAssignmentDialogProps) {
  const handleUserSelect = (value: string) => {
    onStaffFormDataChange({ clerkUserId: value === "none" ? "" : value });
    const selectedUser = clerkUsers.find(u => u.id === value);
    if (selectedUser) {
      onSelectedUserChange({
        id: selectedUser.id,
        name: selectedUser.name || (selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : null),
        emailAddresses: selectedUser.emailAddresses || (selectedUser.email ? [{ emailAddress: selectedUser.email }] : []),
        publicMetadata: {},
      });
    } else {
      onSelectedUserChange(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  onClick={() => onFormModeChange("select")}
                >
                  Select Existing User
                </Button>
                <Button
                  type="button"
                  variant={formMode === "create" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFormModeChange("create")}
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
                onValueChange={handleUserSelect}
                required={formMode === "select"}
              >
                <SelectTrigger id="clerkUserId" className={errors.clerkUserId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clerkUsers
                    .filter(user => {
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
                    <p className="text-xs text-muted-foreground">
                      {selectedUserForStaff.emailAddresses[0].emailAddress}
                    </p>
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
                    onChange={(e) => onStaffFormDataChange({ firstName: e.target.value })}
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
                    onChange={(e) => onStaffFormDataChange({ lastName: e.target.value })}
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
                  onChange={(e) => onStaffFormDataChange({ email: e.target.value })}
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
                  onStaffFormDataChange({
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
                  onValueChange={(value) => onStaffFormDataChange({ scope: value })}
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
              onValueChange={(value) => onStaffFormDataChange({ role: value })}
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
                onChange={(e) => onStaffFormDataChange({ slackUserId: e.target.value })}
                placeholder="U0123ABCD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
              <Input
                id="whatsappNumber"
                value={staffFormData.whatsappNumber}
                onChange={(e) => onStaffFormDataChange({ whatsappNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={savingStaff}>
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
  );
}
