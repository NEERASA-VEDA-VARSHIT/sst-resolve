"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { SubSubcategoryDialog } from "./SubSubcategoryDialog";
import { toast } from "sonner";

interface SubSubcategory {
  id: number;
  subcategory_id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  active: boolean;
}

interface SubSubcategoryManagerProps {
  subcategoryId: number;
}

export function SubSubcategoryManager({ subcategoryId }: SubSubcategoryManagerProps) {
  const [subSubcategories, setSubSubcategories] = useState<SubSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubSubcategory, setEditingSubSubcategory] = useState<SubSubcategory | null>(null);
  // const [expandedSubSubcategories, setExpandedSubSubcategories] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchSubSubcategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcategoryId]);

  const fetchSubSubcategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/sub-subcategories?subcategory_id=${subcategoryId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSubSubcategories(data);
      } else {
        toast.error("Failed to fetch sub-subcategories");
      }
    } catch (error) {
      console.error("Error fetching sub-subcategories:", error);
      toast.error("Failed to fetch sub-subcategories");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubSubcategory = () => {
    setEditingSubSubcategory(null);
    setIsDialogOpen(true);
  };

  const handleEditSubSubcategory = (subSubcategory: SubSubcategory) => {
    setEditingSubSubcategory(subSubcategory);
    setIsDialogOpen(true);
  };

  const handleDeleteSubSubcategory = async (subSubcategory: SubSubcategory, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event bubbling to parent
    
    if (
      !confirm(
        `Are you sure you want to delete "${subSubcategory.name}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sub-subcategories/${subSubcategory.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Sub-subcategory deleted successfully");
        await fetchSubSubcategories();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete sub-subcategory");
      }
    } catch (error) {
      console.error("Error deleting sub-subcategory:", error);
      toast.error("Failed to delete sub-subcategory");
    }
  };

  const handleDialogClose = async (saved: boolean) => {
    setIsDialogOpen(false);
    setEditingSubSubcategory(null);
    if (saved) {
      await fetchSubSubcategories();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleSubSubcategory = (_id: number) => {
    setExpandedSubSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Loading sub-subcategories...</div>;
  }

  return (
    <div className="space-y-3 mt-4 ml-4 border-l-2 border-muted pl-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Sub-Subcategories</h4>
          <p className="text-xs text-muted-foreground">
            {subSubcategories.length} sub-subcategor{subSubcategories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={handleCreateSubSubcategory} size="sm" variant="outline">
          <Plus className="w-3 h-3 mr-1" />
          Add Sub-Subcategory
        </Button>
      </div>

      {subSubcategories.length === 0 ? (
        <div className="text-center py-4 border-2 border-dashed rounded-lg bg-muted/20">
          <p className="text-xs text-muted-foreground mb-2">
            No sub-subcategories yet.
          </p>
          <Button onClick={handleCreateSubSubcategory} size="sm" variant="ghost">
            <Plus className="w-3 h-3 mr-1" />
            Create First Sub-Subcategory
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {subSubcategories.map((subSubcategory) => (
            <Card key={subSubcategory.id} className="border-l-2 border-l-secondary">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <CardTitle className="text-sm font-medium">
                      {subSubcategory.name}
                    </CardTitle>
                    {subSubcategory.description && (
                      <span className="text-xs text-muted-foreground">
                        {subSubcategory.description}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs ml-auto">
                      Order: {subSubcategory.display_order}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSubSubcategory(subSubcategory);
                      }}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubSubcategory(subSubcategory, e);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <SubSubcategoryDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        subcategoryId={subcategoryId}
        subSubcategory={editingSubSubcategory}
      />
    </div>
  );
}

