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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api, endpoints } from "@/lib/api/client";
import { useAdmins, type Admin } from "@/lib/api/admins";
import { useSlugGeneration } from "@/hooks/forms/useSlugGeneration";

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  assigned_admin_id?: string | null;
}

// StaffMember type - using Admin from useFetchAdmins hook

interface SubcategoryDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  categoryId: number;
  subcategory?: Subcategory | null;
  categoryDefaultAdmin?: string | null; // Admin assigned at category level (UUID)
}

export function SubcategoryDialog({
  open,
  onClose,
  categoryId,
  subcategory,
  categoryDefaultAdmin,
}: SubcategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  // By default, do NOT inherit admin from category; let domain/scope logic run first,
  // and only use category default if explicitly chosen.
  const [inheritFromCategory, setInheritFromCategory] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    display_order: 0,
    assigned_admin_id: null as string | null,
  });

  // Use centralized hooks
  const { admins: staffMembers, loading: loadingStaff, refetch: refetchStaff } = useAdmins("staff");
  const { slugManuallyEdited, handleNameChange: handleSlugNameChange, handleSlugChange: handleSlugChangeCallback, setManualEdit } = useSlugGeneration("-");

  useEffect(() => {
    if (open) {
      refetchStaff();
    }
  }, [open, refetchStaff]);

  useEffect(() => {
    if (subcategory) {
      // If there is an explicit admin on the subcategory, do NOT inherit.
      // If there isn't, still default to NOT inheriting; user must opt in.
      setInheritFromCategory(false);
      setFormData({
        name: subcategory.name || "",
        slug: subcategory.slug || "",
        description: subcategory.description || "",
        display_order: subcategory.display_order || 0,
        assigned_admin_id: subcategory.assigned_admin_id || null,
      });
      setManualEdit(true); // When editing, slug is already set
    } else {
      // New subcategory: do not inherit by default
      setInheritFromCategory(false);
      setFormData({
        name: "",
        slug: "",
        description: "",
        display_order: 0,
        assigned_admin_id: null,
      });
      setManualEdit(false); // Reset when creating new
    }
  }, [subcategory, open, setManualEdit]);

  const handleNameChange = (name: string) => {
    handleSlugNameChange(name, formData.slug, (newSlug) => {
      setFormData((prev) => ({
        ...prev,
        name,
        slug: prev.slug || newSlug,
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = subcategory
        ? `${endpoints.admin.subcategories}/${subcategory.id}`
        : endpoints.admin.subcategories;

      const payload = {
        ...formData,
        category_id: categoryId,
        assigned_admin_id: inheritFromCategory ? null : formData.assigned_admin_id,
      };

      if (subcategory) {
        await api.patch(url, payload);
      } else {
        await api.post(url, payload);
      }

      toast.success(
        subcategory ? "Subcategory updated successfully" : "Subcategory created successfully"
      );
      onClose(true);
    } catch (error) {
      console.error("Error saving subcategory:", error);
      // Error toast is handled by api client
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subcategory ? "Edit Subcategory" : "Create New Subcategory"}
          </DialogTitle>
          <DialogDescription>
            {subcategory
              ? "Update subcategory details. You can add fields after saving."
              : "Create a subcategory to organize tickets. Add custom fields after creating."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Subcategory Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Maintenance, Mess, WiFi Issues"
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
                onChange={(e) => {
                  handleSlugChangeCallback(e.target.value, (newSlug) => {
                    setFormData((prev) => ({ ...prev, slug: newSlug }));
                  });
                }}
                placeholder="e.g., maintenance, mess, wifi-issues"
                required
              />
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
              placeholder="Brief description of this subcategory"
              rows={2}
            />
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

          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inherit_admin"
                checked={inheritFromCategory}
                onCheckedChange={(checked) => {
                  setInheritFromCategory(checked === true);
                  if (checked) {
                    setFormData((prev) => ({ ...prev, assigned_admin_id: null }));
                  }
                }}
              />
              <Label htmlFor="inherit_admin" className="cursor-pointer font-medium">
                Inherit admin from category
                {categoryDefaultAdmin && (
                  <span className="text-xs text-muted-foreground ml-2 font-normal">
                    (Currently: {staffMembers.find(s => s.id === categoryDefaultAdmin)?.fullName || staffMembers.find(s => s.id === categoryDefaultAdmin)?.full_name || "Unknown"})
                  </span>
                )}
              </Label>
            </div>
            {!inheritFromCategory && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="assigned_admin_id">Assign Specific Admin</Label>
                <Select
                  value={formData.assigned_admin_id || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      assigned_admin_id: value === "none" ? null : value,
                    }))
                  }
                  disabled={loadingStaff}
                >
                  <SelectTrigger id="assigned_admin_id">
                    <SelectValue placeholder="Select admin (overrides category default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No admin</SelectItem>
                    {staffMembers.map((staff) => {
                      const displayName = staff.fullName || staff.full_name || staff.email || "Unknown";
                      return (
                        <SelectItem key={staff.id} value={staff.id}>
                          {displayName}
                          {staff.domain && ` (${staff.domain}${staff.scope ? ` - ${staff.scope}` : ""})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This admin will override the category default for tickets in this subcategory.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : subcategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

