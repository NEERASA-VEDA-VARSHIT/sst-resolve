"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Scope {
  id: number;
  name: string;
  domain_id: number | null;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  domain: string | null;
  scope: string | null;
  role?: string;
}

interface EscalationRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  editingRule: { id: number } | null;
  formData: {
    level: string;
    scope_id: string;
    user_id: string;
    tat_hours: string;
    notify_channel: string;
  };
  onFormChange: (data: {
    level: string;
    scope_id: string;
    user_id: string;
    tat_hours: string;
    notify_channel: string;
  }) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  relevantScopes: Scope[];
  adminUsers: AdminUser[];
}

export function EscalationRuleForm({
  open,
  onOpenChange,
  categoryName,
  editingRule,
  formData,
  onFormChange,
  onSubmit,
  onCancel,
  saving,
  relevantScopes,
  adminUsers,
}: EscalationRuleFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Edit Escalation Rule" : "Create Escalation Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure escalation rule for {categoryName}. Lower levels escalate first.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="level">
              Escalation Level <span className="text-destructive">*</span>
            </Label>
            <Input
              id="level"
              type="number"
              min="1"
              value={formData.level}
              onChange={(e) => onFormChange({ ...formData, level: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Level determines escalation order (1 = first escalation, 2 = second, etc.)
            </p>
          </div>

          {relevantScopes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={formData.scope_id || "all"}
                onValueChange={(value) => onFormChange({ ...formData, scope_id: value })}
              >
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {categoryName}s</SelectItem>
                  {relevantScopes.map((scope) => (
                    <SelectItem key={scope.id} value={String(scope.id)}>
                      {scope.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="user_id">Assign to Admin</Label>
            <Select
              value={formData.user_id || "none"}
              onValueChange={(value) => onFormChange({ ...formData, user_id: value })}
            >
              <SelectTrigger id="user_id">
                <SelectValue placeholder="Select admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No admin assigned</SelectItem>
                {adminUsers.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.name}
                    {admin.role === "super_admin" && " (Super Admin)"}
                    {admin.domain && ` (${admin.domain}${admin.scope ? ` - ${admin.scope}` : ""})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tat_hours">
              TAT (Hours) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tat_hours"
              type="number"
              min="1"
              value={formData.tat_hours}
              onChange={(e) => onFormChange({ ...formData, tat_hours: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Turnaround time in hours for this escalation level (e.g., 48 for 2 days)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify_channel">Notification Channel</Label>
            <Select
              value={formData.notify_channel}
              onValueChange={(value) => onFormChange({ ...formData, notify_channel: value })}
            >
              <SelectTrigger id="notify_channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
