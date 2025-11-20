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
import { toast } from "sonner";

interface SubSubcategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
}

interface SubSubcategoryDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  subcategoryId: number;
  subSubcategory?: SubSubcategory | null;
}

export function SubSubcategoryDialog({
  open,
  onClose,
  subcategoryId,
  subSubcategory,
}: SubSubcategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    display_order: 0,
  });

  useEffect(() => {
    if (subSubcategory) {
      setFormData({
        name: subSubcategory.name || "",
        slug: subSubcategory.slug || "",
        description: subSubcategory.description || "",
        display_order: subSubcategory.display_order || 0,
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        display_order: 0,
      });
    }
  }, [subSubcategory, open]);

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
      const url = subSubcategory
        ? `/api/admin/sub-subcategories/${subSubcategory.id}`
        : "/api/admin/sub-subcategories";
      const method = subSubcategory ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          subcategory_id: subcategoryId,
        }),
      });

      if (response.ok) {
        toast.success(
          subSubcategory
            ? "Sub-subcategory updated successfully"
            : "Sub-subcategory created successfully"
        );
        onClose(true);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save sub-subcategory");
      }
    } catch (error) {
      console.error("Error saving sub-subcategory:", error);
      toast.error("Failed to save sub-subcategory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subSubcategory ? "Edit Sub-Subcategory" : "Create New Sub-Subcategory"}
          </DialogTitle>
          <DialogDescription>
            {subSubcategory
              ? "Update sub-subcategory details."
              : "Create a sub-subcategory to further organize tickets within a subcategory."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Sub-Subcategory Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Food Quality, Menu Related, Hygiene"
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
                placeholder="e.g., food-quality, menu-related, hygiene"
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
              placeholder="Brief description of this sub-subcategory"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : subSubcategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

