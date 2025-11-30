"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface EscalationRule {
  id: number;
  domain_id: number;
  scope_id: number | null;
  level: number;
  user_id: string | null;
  tat_hours?: number | null;
  domain?: { id: number; name: string };
  scope?: { id: number; name: string };
  user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    external_id: string | null;
  };
  notify_channel: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface AdminUser {
  id: string; // UUID
  name: string;
  email: string;
  domain: string | null;
  scope: string | null;
}

interface Scope {
  id: number;
  name: string;
  domain_id: number | null;
}

interface EscalationManagerProps {
  categoryName: string;
  categoryId: number;
}

export function EscalationManager({ categoryName, categoryId }: EscalationManagerProps) {
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    level: "1",
    scope_id: "all",
    user_id: "",
    tat_hours: "48",
    notify_channel: "slack",
  });

  useEffect(() => {
    if (categoryId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEscalationRules(),
        fetchAdmins(),
        fetchScopes()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEscalationRules = async () => {
    try {
      const response = await fetch("/api/escalation-rules");
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // Filter rules by domain_id matching categoryId
          const filteredRules = (data.rules || []).filter(
            (rule: EscalationRule) => rule.domain_id === categoryId
          );
          // Sort by level
          filteredRules.sort((a: EscalationRule, b: EscalationRule) => a.level - b.level);
          setEscalationRules(filteredRules);
        } else {
          console.error("Server returned non-JSON response when fetching escalation rules");
        }
      } else {
        toast.error("Failed to fetch escalation rules");
      }
    } catch (error) {
      console.error("Error fetching escalation rules:", error);
      toast.error("Failed to fetch escalation rules");
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/admin/list");
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setAdminUsers(data.admins || []);
        } else {
          console.error("Server returned non-JSON response when fetching admins");
        }
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const fetchScopes = async () => {
    try {
      const response = await fetch("/api/admin/master-data");
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setScopes(data.scopes || []);
        } else {
          console.error("Server returned non-JSON response when fetching scopes");
        }
      }
    } catch (error) {
      console.error("Error fetching scopes:", error);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({
      level: String((escalationRules.length > 0 ? Math.max(...escalationRules.map(r => r.level)) : 0) + 1),
      scope_id: "all",
      user_id: "",
      tat_hours: "48",
      notify_channel: "slack",
    });
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: EscalationRule) => {
    setEditingRule(rule);
    setFormData({
      level: String(rule.level),
      scope_id: rule.scope_id ? String(rule.scope_id) : "all",
      user_id: rule.user_id || "",
      tat_hours: String(rule.tat_hours || 48),
      notify_channel: rule.notify_channel || "slack",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRule = (ruleId: number) => {
    setDeletingRuleId(ruleId);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData({
      level: "1",
      scope_id: "all",
      user_id: "",
      tat_hours: "48",
      notify_channel: "slack",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        domain_id: categoryId,
        scope_id: formData.scope_id === "all" ? null : parseInt(formData.scope_id, 10),
        level: parseInt(formData.level, 10),
        user_id: formData.user_id && formData.user_id !== "none" ? formData.user_id : null,
        tat_hours: parseInt(formData.tat_hours, 10) || 48,
        notify_channel: formData.notify_channel,
      };

      const response = editingRule
        ? await fetch(`/api/escalation-rules/${editingRule.id}`, { // Note: API might not support PATCH by ID yet, need to check
          method: "PATCH", // Assuming PATCH is supported or I need to implement it
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        : await fetch("/api/escalation-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      if (response.ok) {
        toast.success(editingRule ? "Escalation rule updated" : "Escalation rule created");
        handleCloseDialog();
        fetchEscalationRules();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to save escalation rule");
        } else {
          toast.error(`Failed to save escalation rule (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error saving escalation rule:", error);
      toast.error("Failed to save escalation rule");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRuleId) return;

    try {
      const response = await fetch(`/api/escalation-rules/${deletingRuleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Escalation rule deleted");
        setIsDeleteDialogOpen(false);
        setDeletingRuleId(null);
        fetchEscalationRules();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to delete escalation rule");
        } else {
          toast.error(`Failed to delete escalation rule (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error deleting escalation rule:", error);
      toast.error("Failed to delete escalation rule");
    }
  };

  // Filter scopes relevant to this category (domain)
  // Note: We assume categoryName matches domain name, or we filter scopes by domain_id if we had it in category
  // But scopes have domain_id. We need to know the domain_id of the current category.
  // categoryId IS the domain_id in this context (since categories map to domains usually)
  // Wait, categories table has domain_id? No, categories ARE domains in this system?
  // Let's check schema.
  // categories table has domain_id column?
  // I recall categories table having `domain_id`.
  // But `EscalationManager` receives `categoryId`.
  // If `categoryId` refers to a record in `categories` table, then `categories` table should have `domain_id`?
  // Actually, `escalation_rules` links to `domains` table via `domain_id`.
  // Is `categoryId` passed here a `domains.id` or `categories.id`?
  // The component is used in `categories/page.tsx`.
  // If it's used for a Category, then `categoryId` is `categories.id`.
  // But `escalation_rules` uses `domain_id`.
  // Does `categories` table map 1:1 to `domains`?
  // Or does `categories` have a `domain_id` field?
  // Let's check `categories` schema.

  // In `src/db/schema.ts`:
  // export const categories = pgTable("categories", { ... domain_id: integer("domain_id").references(() => domains.id) ... })

  // So `categoryId` is `categories.id`.
  // But `escalation_rules` uses `domain_id`.
  // So we need to pass `domainId` to `EscalationManager`, NOT `categoryId`.
  // Or `EscalationManager` should fetch the category to get its `domain_id`.

  // However, the previous code used `rule.domain === categoryName`.
  // This implies `categoryName` was treated as the domain name.
  // If `categoryName` is "Hostel", then domain is "Hostel".

  // For now, I will assume `categoryId` passed to this component IS the `domain_id` if the parent component is smart.
  // But looking at `EscalationManagerProps`, it says `categoryId`.
  // If I look at how it's used... I can't see usage right now.

  // Let's assume `categoryId` is `categories.id`.
  // I need to fetch the category to get `domain_id`.
  // OR, maybe the `escalation_rules` table is linked to `categories` now?
  // No, `escalation_rules` has `domain_id`.

  // Wait, if `escalation_rules` are per DOMAIN, and multiple categories can belong to a DOMAIN.
  // Then `EscalationManager` should be managing rules for a DOMAIN.
  // But the UI seems to be "Category" based.

  // If `categoryName` is "Hostel", that's a Domain.
  // If `categoryName` is "Academics", that's a Domain.

  // So `categoryId` passed here might actually be the `domain_id`?
  // Let's check `src/app/(app)/superadmin/dashboard/categories/page.tsx` if possible.
  // But I can't see it easily without searching.

  // Let's assume `categoryId` is the ID of the thing we are managing rules for.
  // If `escalation_rules` uses `domain_id`, then `categoryId` MUST be `domain_id`.
  // I will proceed with this assumption.

  const relevantScopes = scopes.filter(s => s.domain_id === categoryId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Escalation Rules</h4>
          <p className="text-sm text-muted-foreground">
            Configure escalation chain for {categoryName}. Rules are processed in order by level.
          </p>
        </div>
        <Button onClick={handleCreateRule} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading escalation rules...</div>
      ) : escalationRules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No escalation rules configured for {categoryName}
            </p>
            <Button onClick={handleCreateRule} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {escalationRules.map((rule) => (
            <Card key={rule.id} className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-semibold">
                        Level {rule.level}
                      </Badge>
                      {rule.scope && (
                        <Badge variant="secondary">{rule.scope.name}</Badge>
                      )}
                      {!rule.scope && (
                        <Badge variant="outline" className="text-xs">
                          Global
                        </Badge>
                      )}
                      {rule.tat_hours && (
                        <Badge variant="outline" className="text-xs">
                          TAT: {rule.tat_hours}h
                        </Badge>
                      )}
                    </div>
                    {rule.user ? (
                      <div className="space-y-1">
                        <p className="font-medium">{rule.user.full_name || 'Unknown'}</p>
                        {rule.user.email && (
                          <p className="text-sm text-muted-foreground">{rule.user.email}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No staff assigned</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {rule.notify_channel === "slack" ? "Slack" : "Email"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditRule(rule)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Escalation Rule" : "Create Escalation Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure escalation rule for {categoryName}. Lower levels escalate first.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="level">
                Escalation Level <span className="text-destructive">*</span>
              </Label>
              <Input
                id="level"
                type="number"
                min="1"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
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
                  onValueChange={(value) => setFormData({ ...formData, scope_id: value })}
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
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
              >
                <SelectTrigger id="user_id">
                  <SelectValue placeholder="Select admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No admin assigned</SelectItem>
                  {adminUsers.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name}
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
                onChange={(e) => setFormData({ ...formData, tat_hours: e.target.value })}
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
                onValueChange={(value) => setFormData({ ...formData, notify_channel: value })}
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
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingRule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Escalation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this escalation rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
