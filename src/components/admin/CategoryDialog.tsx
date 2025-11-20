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

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sla_hours: number;
  display_order: number;
  default_authority?: number | null;
}

interface StaffMember {
  id: number;
  full_name: string;
  email: string | null;
  domain: string | null;
  scope: string | null;
}

interface CategoryDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  category?: Category | null;
}

export function CategoryDialog({ open, onClose, category }: CategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "#3B82F6",
    sla_hours: 48,
    display_order: 0,
    default_authority: null as number | null,
  });

  useEffect(() => {
    if (open) {
      fetchStaff();
    }
  }, [open]);

  const fetchStaff = async () => {
    try {
      setLoadingStaff(true);
      const response = await fetch("/api/admin/staff");
      if (response.ok) {
        const data = await response.json();
        setStaffMembers(data.staff || []);
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

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
        default_authority: category.default_authority || null,
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        icon: "",
        color: "#3B82F6",
        sla_hours: 48,
        display_order: 0,
        default_authority: null,
      });
    }
  }, [category, open]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = category
        ? `/api/admin/categories/${category.id}`
        : "/api/admin/categories";
      const method = category ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(category ? "Category updated successfully" : "Category created successfully");
        onClose(true);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save category");
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category");
    } finally {
      setLoading(false);
    }
  };

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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
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
            <Label htmlFor="default_authority">Default Admin Assignment</Label>
            <Select
              key={loadingStaff ? 'loading' : 'loaded'}
              value={formData.default_authority?.toString() || "none"}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  default_authority: value === "none" ? null : parseInt(value),
                }))
              }
              disabled={loadingStaff}
            >
              <SelectTrigger id="default_authority">
                <SelectValue placeholder={loadingStaff ? "Loading staff..." : "No default admin (will use escalation rules)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default admin</SelectItem>
                {staffMembers.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id.toString()}>
                    {staff.full_name}
                    {staff.domain && ` (${staff.domain}${staff.scope ? ` - ${staff.scope}` : ""})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default admin for tickets in this category. Can be overridden at subcategory or field level.
            </p>
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

