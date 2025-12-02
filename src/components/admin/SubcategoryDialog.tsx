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

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  assigned_admin_id?: string | null;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string | null;
  domain: string | null;
  scope: string | null;
}

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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
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

  useEffect(() => {
    if (open) {
      fetchStaff();
    }
  }, [open]);

  const fetchStaff = async () => {
    try {
      setLoadingStaff(true);
      const response = await fetch("/api/admin/staff");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("[SubcategoryDialog] Failed to fetch staff:", response.status, errorData);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("[SubcategoryDialog] API returned non-JSON response");
        return;
      }

      const data = await response.json();
      // Normalize API response to our local StaffMember shape
      type ApiStaff = {
        id: string;
        fullName?: string | null;
        email?: string | null;
        domain?: string | null;
        scope?: string | null;
        [key: string]: unknown;
      };
      const mapped: StaffMember[] = (data.staff || []).map((s: ApiStaff) => ({
        id: s.id,
        full_name: (s.fullName || s.email || "Unknown") as string,
        email: s.email ?? null,
        domain: s.domain ?? null,
        scope: s.scope ?? null,
      }));
      setStaffMembers(mapped);
    } catch (error) {
      console.error("[SubcategoryDialog] Error fetching staff:", error);
      toast.error("Failed to load admins. Please try again.");
    } finally {
      setLoadingStaff(false);
    }
  };

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
    }
  }, [subcategory, open]);

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
      const url = subcategory
        ? `/api/admin/subcategories/${subcategory.id}`
        : "/api/admin/subcategories";
      const method = subcategory ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          category_id: categoryId,
          assigned_admin_id: inheritFromCategory ? null : formData.assigned_admin_id,
        }),
      });

      if (response.ok) {
        toast.success(
          subcategory ? "Subcategory updated successfully" : "Subcategory created successfully"
        );
        onClose(true);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save subcategory");
      }
    } catch (error) {
      console.error("Error saving subcategory:", error);
      toast.error("Failed to save subcategory");
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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
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
                    (Currently: {staffMembers.find(s => s.id === categoryDefaultAdmin)?.full_name || "Unknown"})
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
                    {staffMembers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.full_name}
                        {staff.domain && ` (${staff.domain}${staff.scope ? ` - ${staff.scope}` : ""})`}
                      </SelectItem>
                    ))}
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

