"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Bell,
  MessageSquare,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface NotificationConfig {
  id: number;
  scope_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
  scope_name: string | null;
  domain_name: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  enable_slack: boolean;
  enable_email: boolean;
  slack_channel: string | null;
  slack_cc_user_ids: string[] | null;
  email_recipients: string[] | null;
  priority: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface Category {
  id: number;
  name: string;
}

interface Scope {
  id: number;
  name: string;
  domain_id: number;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

interface Admin {
  id: string;
  fullName: string;
  email: string;
  slackUserId: string | null;
}

export function NotificationSettingsManager() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  // Use "__none__" as a special value for empty selects (Radix UI doesn't allow empty strings)
  const [formData, setFormData] = useState({
    scope_id: "__none__",
    category_id: "__none__",
    subcategory_id: "__none__",
    enable_slack: true,
    enable_email: true,
    slack_channel: "",
    slack_cc_user_ids: [] as string[],
    email_recipients: [] as string[],
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (formData.category_id && formData.category_id !== "__none__") {
      const fetchSubcategories = async () => {
        try {
          // Validate category_id is a valid number before fetching
          const categoryIdNum = parseInt(formData.category_id, 10);
          if (isNaN(categoryIdNum) || categoryIdNum <= 0) {
            return;
          }
          
          const res = await fetch(`/api/admin/subcategories?category_id=${categoryIdNum}`);
          if (res.ok) {
            const data = await res.json();
            // API returns array directly, not wrapped in object
            const subcatsArray = Array.isArray(data) ? data : (data.subcategories || data || []);
            const fetched = subcatsArray.map((s: { id: number; name: string; category_id?: number }) => ({
              id: s.id,
              name: s.name,
              category_id: s.category_id || categoryIdNum,
            }));
            setSubcategories((prev) => {
              // Merge with existing, avoiding duplicates
              const existing = prev.filter((s) => s.category_id !== categoryIdNum);
              return [...existing, ...fetched];
            });
          }
        } catch (error) {
          console.error("Error fetching subcategories:", error);
        }
      };
      fetchSubcategories();
    } else {
      // Clear subcategories when no category is selected
      setSubcategories((prev) => prev.filter((s) => s.category_id !== parseInt(formData.category_id || "0", 10)));
    }
  }, [formData.category_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configsRes, masterDataRes, adminsRes, scopesRes] = await Promise.all([
        fetch("/api/superadmin/notification-config"),
        fetch("/api/admin/master-data"),
        fetch("/api/admin/staff"),
        fetch("/api/superadmin/scopes?active=true"),
      ]);

      if (configsRes.ok) {
        const configsData = await configsRes.json();
        setConfigs(configsData.configs || []);
      }

      let categoriesList: Category[] = [];
      if (masterDataRes.ok) {
        const masterData = await masterDataRes.json();
        categoriesList = masterData.categories || [];
        setCategories(categoriesList);
      }

      // Fetch all subcategories by fetching from each category
      if (categoriesList.length > 0) {
        try {
          const subcategoryPromises = categoriesList.map((cat: Category) =>
            fetch(`/api/admin/subcategories?category_id=${cat.id}`)
              .then((res) => res.json())
              .then((data) => {
                // API returns array directly, not wrapped in object
                const subcatsArray = Array.isArray(data) ? data : (data.subcategories || []);
                return subcatsArray.map((s: { id: number; name: string; category_id?: number }) => ({
                  id: s.id,
                  name: s.name,
                  category_id: s.category_id || cat.id,
                }));
              })
              .catch(() => [])
          );
          const subcategoryArrays = await Promise.all(subcategoryPromises);
          setSubcategories(subcategoryArrays.flat());
        } catch (error) {
          console.error("Error fetching subcategories:", error);
        }
      }

      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        // Filter admins with Slack user IDs
        const adminsWithSlack = (adminsData.staff || []).filter(
          (admin: Admin) => admin.slackUserId && admin.slackUserId.trim() !== ""
        );
        setAdmins(adminsWithSlack);
      }

      // Fetch scopes (for scope-level configs)
      if (scopesRes.ok) {
        const scopesData = await scopesRes.json();
        const scopeList = Array.isArray(scopesData)
          ? scopesData
          : Array.isArray(scopesData.scopes)
          ? scopesData.scopes
          : [];
        setScopes(
          scopeList.map((s: { id: number; name: string; domain_id: number }) => ({
            id: s.id,
            name: s.name,
            domain_id: s.domain_id,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (config?: NotificationConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        scope_id: config.scope_id?.toString() || "__none__",
        category_id: config.category_id?.toString() || "__none__",
        subcategory_id: config.subcategory_id?.toString() || "__none__",
        enable_slack: config.enable_slack ?? true,
        enable_email: config.enable_email ?? true,
        slack_channel: config.slack_channel || "",
        slack_cc_user_ids: Array.isArray(config.slack_cc_user_ids) ? config.slack_cc_user_ids : [],
        email_recipients: Array.isArray(config.email_recipients) ? config.email_recipients : [],
      });
    } else {
      setEditingConfig(null);
      setFormData({
        scope_id: "__none__",
        category_id: "__none__",
        subcategory_id: "__none__",
        enable_slack: true,
        enable_email: true,
        slack_channel: "",
        slack_cc_user_ids: [],
        email_recipients: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingConfig(null);
    setFormData({
      scope_id: "__none__",
      category_id: "__none__",
      subcategory_id: "__none__",
      enable_slack: true,
      enable_email: true,
      slack_channel: "",
      slack_cc_user_ids: [],
      email_recipients: [],
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert "__none__" to null for API
      const scopeId = formData.scope_id && formData.scope_id !== "__none__"
        ? parseInt(formData.scope_id, 10)
        : null;
      const categoryId = formData.category_id && formData.category_id !== "__none__" 
        ? parseInt(formData.category_id, 10) 
        : null;
      const subcategoryId = formData.subcategory_id && formData.subcategory_id !== "__none__"
        ? parseInt(formData.subcategory_id, 10)
        : null;

      const payload = {
        scope_id: scopeId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        enable_slack: formData.enable_slack,
        enable_email: formData.enable_email,
        slack_channel: formData.slack_channel.trim() || null,
        slack_cc_user_ids: formData.slack_cc_user_ids.length > 0 ? formData.slack_cc_user_ids : null,
        email_recipients: formData.email_recipients.length > 0 ? formData.email_recipients : null,
      };

      const url = editingConfig
        ? `/api/superadmin/notification-config/${editingConfig.id}`
        : "/api/superadmin/notification-config";
      const method = editingConfig ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to save" }));
        throw new Error(error.error || "Failed to save");
      }

      toast.success(editingConfig ? "Notification settings updated" : "Notification settings created");
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this notification configuration?")) {
      return;
    }

    try {
      const response = await fetch(`/api/superadmin/notification-config/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Notification configuration deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting config:", error);
      toast.error("Failed to delete notification configuration");
    }
  };

  const filteredSubcategories = formData.category_id && formData.category_id !== "__none__"
    ? (() => {
        const categoryIdNum = parseInt(formData.category_id, 10);
        if (isNaN(categoryIdNum) || categoryIdNum <= 0) return [];
        return subcategories.filter((s) => s.category_id === categoryIdNum);
      })()
    : [];

  const getScopeLabel = (config: NotificationConfig) => {
    if (config.subcategory_id && config.subcategory_name) {
      return `${config.category_name} → ${config.subcategory_name}`;
    }
    if (config.category_id && config.category_name) {
      return config.category_name;
    }
    if (config.scope_id && config.scope_name) {
      return `${config.domain_name || "Domain"} → ${config.scope_name}`;
    }
    return "Global Default";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Notification Configurations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Slack channels and email recipients for ticket notifications
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          New Configuration
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurations</CardTitle>
          <CardDescription>
            Priority: Subcategory (20) &gt; Category (10) &gt; Scope (5) &gt; Global Default (0)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No notification configurations found</p>
              <p className="text-sm mt-2">Create one to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Slack Channel</TableHead>
                  <TableHead>Slack CC</TableHead>
                  <TableHead>Email Recipients</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Badge variant={config.category_id ? "default" : "secondary"}>
                        {getScopeLabel(config)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.slack_channel ? (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {config.slack_channel}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-sm">Default</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.slack_cc_user_ids && config.slack_cc_user_ids.length > 0 ? (
                        <Badge variant="outline">{config.slack_cc_user_ids.length} users</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.email_recipients && config.email_recipients.length > 0 ? (
                        <Badge variant="outline">{config.email_recipients.length} emails</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-4">
                        {config.enable_slack ? (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Slack
                          </Badge>
                        ) : null}
                        {config.enable_email ? (
                          <Badge variant="outline" className="text-xs">
                            <Mail className="w-3 h-3 mr-1" />
                            Email
                          </Badge>
                        ) : null}
                        {!config.enable_slack && !config.enable_email && (
                          <span className="text-muted-foreground text-sm">Disabled</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{config.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit Notification Configuration" : "New Notification Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure Slack channels and email recipients for ticket notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Scope / Category Selection */}
            <div className="space-y-4">
              {/* Scope */}
              <div>
                <Label>Scope (Optional)</Label>
                <Select
                  value={formData.scope_id}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      scope_id: value,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope (leave empty for global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No specific scope (global or category-based)</SelectItem>
                    {scopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id.toString()}>
                        {scope.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Scope-level configs apply when category is not set. Category / subcategory configs override scope.
                </p>
              </div>

              {/* Category */}
              <div>
                <Label>Category (Optional)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      category_id: value,
                      subcategory_id: "__none__", // Reset subcategory when category changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (leave empty for global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Global Default</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for global default configuration. Note: Category configs override scope configs.
                </p>
              </div>

              {formData.category_id && formData.category_id !== "__none__" && (
                <div>
                  <Label>Subcategory (Optional)</Label>
                  <Select
                    value={formData.subcategory_id}
                    onValueChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        subcategory_id: value,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Category-level only</SelectItem>
                      {filteredSubcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for category-level configuration
                  </p>
                </div>
              )}
            </div>

            {/* Enable/Disable Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Slack Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send notifications to Slack channels
                  </p>
                </div>
                <Switch
                  checked={formData.enable_slack}
                  onCheckedChange={(checked) => {
                    setFormData((prev) => ({ ...prev, enable_slack: checked }));
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send email notifications
                  </p>
                </div>
                <Switch
                  checked={formData.enable_email}
                  onCheckedChange={(checked) => {
                    setFormData((prev) => ({ ...prev, enable_email: checked }));
                  }}
                />
              </div>
            </div>

            {/* Slack Channel */}
            {formData.enable_slack && (
              <div>
                <Label htmlFor="slack_channel">Slack Channel</Label>
                <Input
                  id="slack_channel"
                  placeholder="#tickets-hostel or C03ABC123"
                  value={formData.slack_channel}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, slack_channel: e.target.value }));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Channel name (e.g., #tickets-hostel) or Slack channel ID. Leave empty to use default routing.
                </p>
              </div>
            )}

            {/* Slack CC Users */}
            {formData.enable_slack && (
              <div>
                <Label>Slack CC Users</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select admins to CC on Slack notifications (must have Slack user ID configured)
                </p>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                  {admins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No admins with Slack user IDs configured
                    </p>
                  ) : (
                    admins.map((admin) => {
                      // Use admin.id as unique key, but track by slackUserId in the array
                      // This ensures each admin checkbox is independent
                      const slackUserId = admin.slackUserId || "";
                      const isChecked = Boolean(slackUserId && formData.slack_cc_user_ids.includes(slackUserId));
                      
                      return (
                        <div key={admin.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`slack-cc-${admin.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (!slackUserId) return; // Skip if no slackUserId
                              
                              setFormData((prev) => {
                                const currentIds = prev.slack_cc_user_ids || [];
                                if (checked) {
                                  // Only add if not already present
                                  if (!currentIds.includes(slackUserId)) {
                                    return {
                                      ...prev,
                                      slack_cc_user_ids: [...currentIds, slackUserId],
                                    };
                                  }
                                } else {
                                  // Remove this specific slackUserId
                                  return {
                                    ...prev,
                                    slack_cc_user_ids: currentIds.filter((id) => id !== slackUserId),
                                  };
                                }
                                return prev;
                              });
                            }}
                          />
                          <Label
                            htmlFor={`slack-cc-${admin.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {admin.fullName} ({admin.email})
                            {slackUserId && (
                              <code className="ml-2 text-xs bg-muted px-1 rounded">
                                {slackUserId}
                              </code>
                            )}
                          </Label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Email Recipients */}
            {formData.enable_email && (
              <div>
                <Label htmlFor="email_recipients">Email Recipients</Label>
                <Input
                  id="email_recipients"
                  placeholder="email1@example.com, email2@example.com"
                  value={formData.email_recipients.join(", ")}
                  onChange={(e) => {
                    const emails = e.target.value
                      .split(",")
                      .map((email) => email.trim())
                      .filter((email) => email.length > 0);
                    setFormData((prev) => ({ ...prev, email_recipients: emails }));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of email addresses to CC on notifications
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingConfig ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
