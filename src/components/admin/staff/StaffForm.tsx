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
  id: string;
  clerkUserId: string | null;
  fullName: string;
  email: string | null;
  slackUserId: string | null;
  whatsappNumber: string | null;
  role: string;
  domain: string;
  scope: string | null;
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  name?: string;
  email?: string;
}

interface MasterData {
  hostels: Array<{ id: number; name: string }>;
  domains: Array<{ value: string; label: string }>;
  roles: Array<{ value: string; label: string; description: string | null }>;
  scopes: Array<{ value: string; label: string }>;
}

type StaffFormData = {
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

interface StaffFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStaff: StaffMember | null;
  formMode: "select" | "create";
  onFormModeChange: (mode: "select" | "create") => void;
  formData: StaffFormData;
  onFormDataChange: (data: Partial<StaffFormData>) => void;
  clerkUsers: ClerkUser[];
  staff: StaffMember[];
  masterData: MasterData | null;
  errors: Record<string, string>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  selectedUserFullName: string;
  selectedUserEmail: string;
}

export function StaffForm({
  open,
  onOpenChange,
  editingStaff,
  formMode,
  onFormModeChange,
  formData,
  onFormDataChange,
  clerkUsers,
  staff,
  masterData,
  errors,
  saving,
  onSubmit,
  onClose,
  selectedUserFullName,
  selectedUserEmail,
}: StaffFormProps) {
  const selectedUser = clerkUsers.find(u => u.id === formData.clerkUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          <DialogDescription>
            {editingStaff ? "Update staff member details" : "Assign an admin to a domain and location. This determines which tickets they will automatically receive. Note: Domain and scope are optional for Super Admin."}
          </DialogDescription>
          {!editingStaff && (
            <ul className="mt-2 ml-4 list-disc text-sm space-y-1 text-muted-foreground">
              <li><strong>Domain:</strong> Select the category (Hostel/College). Optional for Super Admin.</li>
              <li><strong>Scope:</strong> For Hostel domain, select specific hostel. For College, no scope needed. Optional for Super Admin.</li>
            </ul>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                {formMode === "select" 
                  ? "Select an existing user from Clerk to assign as staff."
                  : "Create a new user account and assign them as staff. They will need to sign up with Clerk using this email."}
              </p>
            </div>
          )}
          {editingStaff && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Editing: {editingStaff.fullName}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                You can update domain, scope, role, and contact information. User cannot be changed.
              </p>
            </div>
          )}

          {formMode === "select" ? (
            <div className="space-y-2">
              <Label htmlFor="clerkUserId">Select User *</Label>
              {editingStaff ? (
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg space-y-1 border">
                    <p className="text-sm font-medium">{editingStaff.fullName}</p>
                    {editingStaff.email && (
                      <p className="text-xs text-muted-foreground">{editingStaff.email}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User cannot be changed when editing. To change the user, delete and recreate the staff member.
                  </p>
                </div>
              ) : (
                <>
                  <Select
                    value={formData.clerkUserId || undefined}
                    onValueChange={(value) => {
                      onFormDataChange({ clerkUserId: value === "none" ? "" : value });
                    }}
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
                        .map((user, index) => {
                          const displayName = user.name ||
                            (user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.emailAddresses?.[0]?.emailAddress ||
                              user.email ||
                              user.id);
                          return (
                            <SelectItem key={`user-${user.id}-${index}`} value={user.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  {selectedUser && (
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <p className="text-sm font-medium">{selectedUserFullName}</p>
                      {selectedUserEmail && (
                        <p className="text-xs text-muted-foreground">{selectedUserEmail}</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select a user from Clerk. Their name and email will be automatically used.
                  </p>
                  {errors.clerkUserId && (
                    <p className="text-sm text-destructive">{errors.clerkUserId}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => onFormDataChange({ firstName: e.target.value })}
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
                    value={formData.lastName}
                    onChange={(e) => onFormDataChange({ lastName: e.target.value })}
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
                  value={formData.email}
                  onChange={(e) => onFormDataChange({ email: e.target.value })}
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
              <Label htmlFor="domain">
                Domain <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.domain}
                onValueChange={(value) => {
                  onFormDataChange({ domain: value });
                }}
                required
              >
                <SelectTrigger id="domain" className={errors.domain ? "border-destructive" : ""}>
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
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">
                Scope (Hostel/Location) <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => {
                  onFormDataChange({ scope: value });
                }}
                required
                disabled={!masterData || (masterData.scopes.length === 0 && masterData.hostels.length === 0)}
              >
                <SelectTrigger id="scope" className={errors.scope ? "border-destructive" : ""}>
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
                            {hostel.name}
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
                  📍 Showing {masterData.scopes.length} existing location{masterData.scopes.length !== 1 ? 's' : ''} from staff data
                  {masterData.hostels.length > 0 && ` + ${masterData.hostels.length} from hostels table`}
                </p>
              )}
              {errors.scope && (
                <p className="text-sm text-destructive">{errors.scope}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => {
                onFormDataChange({ role: value });
              }}
              required
              disabled={!masterData || masterData.roles.length === 0}
            >
              <SelectTrigger id="role" className={errors.role ? "border-destructive" : ""}>
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
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slackUserId">Slack User ID</Label>
              <Input
                id="slackUserId"
                value={formData.slackUserId}
                onChange={(e) => onFormDataChange({ slackUserId: e.target.value })}
                placeholder="U0123ABCD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
              <Input
                id="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={(e) => onFormDataChange({ whatsappNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingStaff ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
