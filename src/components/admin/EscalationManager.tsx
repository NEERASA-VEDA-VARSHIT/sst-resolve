"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  domain: string;
  scope: string | null;
  level: number;
  staff_id: number | null;
  staff?: {
    id: number;
    full_name: string;
    email: string | null;
    clerk_user_id: string | null;
  };
  notify_channel: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface StaffMember {
  id: number;
  full_name: string;
  email: string | null;
  domain: string | null;
  scope: string | null;
}

interface EscalationManagerProps {
  categoryName: string;
  categoryId: number;
}

export function EscalationManager({ categoryName, categoryId }: EscalationManagerProps) {
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    level: "1",
    scope: "",
    staff_id: "",
    notify_channel: "slack",
  });

  useEffect(() => {
    if (categoryName) {
      fetchEscalationRules();
      fetchStaff();
    }
  }, [categoryName]);

  const fetchEscalationRules = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/escalation-rules");
      if (response.ok) {
        const data = await response.json();
        // Filter rules by domain matching category name
        const filteredRules = (data.rules || []).filter(
          (rule: EscalationRule) => rule.domain === categoryName
        );
        // Sort by level
        filteredRules.sort((a: EscalationRule, b: EscalationRule) => a.level - b.level);
        setEscalationRules(filteredRules);
      } else {
        toast.error("Failed to fetch escalation rules");
      }
    } catch (error) {
      console.error("Error fetching escalation rules:", error);
      toast.error("Failed to fetch escalation rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        setStaffMembers(data.staff || []);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({
      level: String((escalationRules.length > 0 ? Math.max(...escalationRules.map(r => r.level)) : 0) + 1),
      scope: "",
      staff_id: "",
      notify_channel: "slack",
    });
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: EscalationRule) => {
    setEditingRule(rule);
    setFormData({
      level: String(rule.level),
      scope: rule.scope || "",
      staff_id: rule.staff_id ? String(rule.staff_id) : "",
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
      scope: "",
      staff_id: "",
      notify_channel: "slack",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        domain: categoryName,
        scope: categoryName === "College" ? null : (formData.scope === "all" || !formData.scope ? null : formData.scope),
        level: parseInt(formData.level, 10),
        staff_id: formData.staff_id && formData.staff_id !== "none" ? parseInt(formData.staff_id, 10) : null,
        notify_channel: formData.notify_channel,
      };

      const response = editingRule
        ? await fetch(`/api/escalation-rules/${editingRule.id}`, {
            method: "PATCH",
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
        const error = await response.json();
        toast.error(error.error || "Failed to save escalation rule");
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
        const error = await response.json();
        toast.error(error.error || "Failed to delete escalation rule");
      }
    } catch (error) {
      console.error("Error deleting escalation rule:", error);
      toast.error("Failed to delete escalation rule");
    }
  };

  // Get available scopes based on category
  const getAvailableScopes = () => {
    if (categoryName === "Hostel") {
      return ["Neeladri", "Velankani", "all"];
    }
    return [];
  };

  const availableScopes = getAvailableScopes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Escalation Rules</h4>
          <p className="text-sm text-muted-foreground">
            Configure escalation chain for {categoryName} tickets. Rules are processed in order by level.
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
                        <Badge variant="secondary">{rule.scope}</Badge>
                      )}
                      {!rule.scope && categoryName === "Hostel" && (
                        <Badge variant="secondary">All Hostels</Badge>
                      )}
                    </div>
                    {rule.staff ? (
                      <div className="space-y-1">
                        <p className="font-medium">{rule.staff.full_name}</p>
                        {rule.staff.email && (
                          <p className="text-sm text-muted-foreground">{rule.staff.email}</p>
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
              Configure escalation rule for {categoryName} tickets. Lower levels escalate first.
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

            {categoryName === "Hostel" && availableScopes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="scope">Scope (Hostel)</Label>
                <Select
                  value={formData.scope || "all"}
                  onValueChange={(value) => setFormData({ ...formData, scope: value })}
                >
                  <SelectTrigger id="scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hostels</SelectItem>
                    {availableScopes
                      .filter((s) => s !== "all")
                      .map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {scope}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="staff_id">Assign to Staff</Label>
              <Select
                value={formData.staff_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
              >
                <SelectTrigger id="staff_id">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No staff assigned</SelectItem>
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={String(staff.id)}>
                      {staff.full_name}
                      {staff.domain && ` (${staff.domain}${staff.scope ? ` - ${staff.scope}` : ""})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

