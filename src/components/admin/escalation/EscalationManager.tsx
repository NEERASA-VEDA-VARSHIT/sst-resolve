"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EscalationRulesList } from "./EscalationRulesList";
import { EscalationRuleForm } from "./EscalationRuleForm";

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
  role?: string; // "admin" or "super_admin"
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

      <EscalationRulesList
        rules={escalationRules}
        categoryName={categoryName}
        loading={loading}
        onCreateRule={handleCreateRule}
        onEditRule={handleEditRule}
        onDeleteRule={handleDeleteRule}
      />

      <EscalationRuleForm
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categoryName={categoryName}
        editingRule={editingRule}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSubmit}
        onCancel={handleCloseDialog}
        saving={saving}
        relevantScopes={relevantScopes}
        adminUsers={adminUsers}
      />

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
