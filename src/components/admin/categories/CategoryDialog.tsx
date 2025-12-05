"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api, endpoints } from "@/lib/api/client";
import { useAdmins, type Admin } from "@/lib/api/admins";
import { useFetchDomains } from "@/hooks/api/useFetchDomains";
import { useSlugGeneration } from "@/hooks/forms/useSlugGeneration";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sla_hours: number;
  display_order: number;
  domain_id?: number | null;
  scope_id?: number | null;
  default_admin_id?: string | null;
}

interface Domain {
  id: number;
  name: string;
  description: string | null;
}

interface Scope {
  id: number;
  domain_id: number;
  name: string;
  description: string | null;
}

// Admin type imported from useFetchAdmins hook

interface CategoryDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  category?: Category | null;
}

export function CategoryDialog({ open, onClose, category }: CategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "#3B82F6",
    sla_hours: 48,
    display_order: 0,
    domain_id: 1,
    scope_id: null as number | null,
    default_admin_id: null as string | null,
  });

  // Use centralized hooks
  const { domains, scopes, loading: loadingDomains, refetch: refetchDomains } = useFetchDomains();
  const { admins, loading: loadingAdmins, refetch: refetchAdmins } = useAdmins("staff");
  const { slugManuallyEdited, handleNameChange: handleSlugNameChange, handleSlugChange: handleSlugChangeCallback, setManualEdit } = useSlugGeneration("-");

  useEffect(() => {
    if (open) {
      refetchDomains();
      refetchAdmins();
    }
  }, [open, refetchDomains, refetchAdmins]);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
        icon: category.icon || "",
        color: category.color || "#3B82F6",
        sla_hours: category.sla_hours || 48,
        display_order: category.display_order || 0,
        domain_id: category.domain_id || 1,
        scope_id: category.scope_id || null,
        default_admin_id: category.default_admin_id || null,
      });
      setManualEdit(true); // When editing, slug is already set, so mark as manually edited
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        icon: "",
        color: "#3B82F6",
        sla_hours: 48,
        display_order: 0,
        domain_id: 1,
        scope_id: null,
        default_admin_id: null,
      });
      setManualEdit(false); // Reset when creating new category
    }
  }, [category, open, setManualEdit]);

  const handleNameChange = (name: string) => {
    handleSlugNameChange(name, formData.slug, (newSlug) => {
      setFormData((prev) => ({
        ...prev,
        name,
        slug: newSlug,
      }));
    });
  };

  const handleSlugChange = (slug: string) => {
    handleSlugChangeCallback(slug, (newSlug) => {
      setFormData((prev) => ({
        ...prev,
        slug: newSlug,
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = category
        ? `${endpoints.admin.categories}/${category.id}`
        : endpoints.admin.categories;

      if (category) {
        await api.patch(url, formData);
      } else {
        await api.post(url, formData);
      }

      toast.success(category ? "Category updated successfully" : "Category created successfully");
      onClose(true);
    } catch (error) {
      console.error("Error saving category:", error);
      // Error toast is handled by api client
    } finally {
      setLoading(false);
    }
  };

  // Get filtered scopes for selected domain
  const filteredScopes = scopes.filter(scope => scope.domain_id === formData.domain_id);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Create New Category"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Update category details. Changes will affect all tickets using this category."
              : "Create a new category for tickets. You can add subcategories and fields later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Maintenance, Food, WiFi"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g., maintenance, food, wifi"
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of this category"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain_id">
                Domain <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.domain_id?.toString() || ""}
                onValueChange={(value) => {
                  const domainId = parseInt(value);
                  setFormData((prev) => ({
                    ...prev,
                    domain_id: domainId,
                    scope_id: null // Reset scope when domain changes
                  }));
                }}
                disabled={loadingDomains}
              >
                <SelectTrigger id="domain_id">
                  <SelectValue placeholder={loadingDomains ? "Loading..." : "Select domain"} />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id.toString()}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The operational area this category belongs to
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope_id">Scope (Optional)</Label>
              <Select
                value={formData.scope_id?.toString() || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    scope_id: value === "none" ? null : parseInt(value)
                  }))
                }
                disabled={loadingDomains || filteredScopes.length === 0}
              >
                <SelectTrigger id="scope_id">
                  <SelectValue placeholder={filteredScopes.length === 0 ? "No scopes available" : "Select scope"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific scope</SelectItem>
                  {filteredScopes.map((scope) => (
                    <SelectItem key={scope.id} value={scope.id.toString()}>
                      {scope.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Specific scope within the domain (e.g., hostel buildings)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, icon: e.target.value }))
                }
                placeholder="e.g., home, wifi, utensils"
              />
              <p className="text-xs text-muted-foreground">
                Lucide icon name
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sla_hours">
                Default SLA (Hours) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sla_hours"
                type="number"
                value={formData.sla_hours}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sla_hours: parseInt(e.target.value) || 48,
                  }))
                }
                min="1"
                required
              />
              <p className="text-xs text-muted-foreground">
                Default turnaround time for tickets in this category
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_admin_id">Default Admin (Optional)</Label>
              <Select
                value={formData.default_admin_id || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    default_admin_id: value === "none" ? null : value,
                  }))
                }
                disabled={loadingAdmins}
              >
                <SelectTrigger id="default_admin_id">
                  <SelectValue placeholder={loadingAdmins ? "Loading admins..." : "Select default admin"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default admin</SelectItem>
                  {admins.length === 0 ? (
                    <SelectItem value="__no_admins" disabled>
                      {loadingAdmins ? "Loading admins..." : "No admins found"}
                    </SelectItem>
                  ) : (
                    admins.map((admin) => {
                      const fullName = admin.fullName || admin.full_name || null;
                      const displayName = fullName || admin.email || "Unknown";
                      return (
                        <SelectItem key={admin.id} value={admin.id}>
                          {displayName} {fullName && admin.email && <span className="text-muted-foreground">({admin.email})</span>}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Fallback admin for tickets in this category (Priority #5 in assignment chain)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
