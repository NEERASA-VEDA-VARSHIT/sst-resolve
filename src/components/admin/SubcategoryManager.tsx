"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { SubcategoryDialog } from "./SubcategoryDialog";
import { SubSubcategoryManager } from "./SubSubcategoryManager";
import { FieldBuilder } from "./FieldBuilder";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SubSubcategory {
  id: number;
  subcategory_id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  active: boolean;
}

interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  active: boolean;
  assigned_admin_id?: number | null;
  fields?: Field[];
  sub_subcategories?: SubSubcategory[];
}

interface Field {
  id: number;
  subcategory_id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  validation_rules: any;
  display_order: number;
  active: boolean;
  options?: FieldOption[];
}

interface FieldOption {
  id: number;
  field_id: number;
  label: string;
  value: string;
  display_order: number;
  active: boolean;
}

interface SubcategoryManagerProps {
  categoryId: number;
  categoryDefaultAdmin?: number | null;
}

export function SubcategoryManager({ categoryId, categoryDefaultAdmin }: SubcategoryManagerProps) {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchSubcategories();
  }, [categoryId]);

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/subcategories?category_id=${categoryId}&include_fields=true&include_sub_subcategories=true`
      );
      if (response.ok) {
        const data = await response.json();
        setSubcategories(data);
      } else {
        toast.error("Failed to fetch subcategories");
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      toast.error("Failed to fetch subcategories");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubcategory = () => {
    setEditingSubcategory(null);
    setIsDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setIsDialogOpen(true);
  };

  const handleDeleteSubcategory = async (subcategory: Subcategory) => {
    if (
      !confirm(
        `Are you sure you want to delete "${subcategory.name}"? This will also delete all fields.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subcategories/${subcategory.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Subcategory deleted successfully");
        await fetchSubcategories();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete subcategory");
      }
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      toast.error("Failed to delete subcategory");
    }
  };

  const handleDialogClose = async (saved: boolean) => {
    setIsDialogOpen(false);
    setEditingSubcategory(null);
    if (saved) {
      await fetchSubcategories();
    }
  };

  const toggleSubcategory = (id: number) => {
    setExpandedSubcategories((prev) => {
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
    return <div className="text-center py-8">Loading subcategories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Subcategories</h3>
          <p className="text-sm text-muted-foreground">
            {subcategories.length} subcategor{subcategories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={handleCreateSubcategory} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Subcategory
        </Button>
      </div>

      {subcategories.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-semibold mb-1">No subcategories yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create subcategories to organize tickets within this category.
          </p>
          <Button onClick={handleCreateSubcategory} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Subcategory
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subcategories.map((subcategory) => (
            <Collapsible
              key={subcategory.id}
              open={expandedSubcategories.has(subcategory.id)}
              onOpenChange={() => toggleSubcategory(subcategory.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {expandedSubcategories.has(subcategory.id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">{subcategory.name}</CardTitle>
                        {subcategory.description && (
                          <span className="text-sm text-muted-foreground">
                            {subcategory.description}
                          </span>
                        )}
                        <Badge variant="outline" className="ml-auto">
                          {subcategory.fields?.length || 0} field
                          {(subcategory.fields?.length || 0) !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditSubcategory(subcategory)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteSubcategory(subcategory)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <SubSubcategoryManager subcategoryId={subcategory.id} />
                    <div className="border-t pt-4">
                      <FieldBuilder
                        subcategoryId={subcategory.id}
                        initialFields={subcategory.fields || []}
                        onFieldsChange={fetchSubcategories}
                        subcategoryDefaultAdmin={subcategory.assigned_admin_id ? String(subcategory.assigned_admin_id) : (categoryDefaultAdmin ? String(categoryDefaultAdmin) : null)}
                      />
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <SubcategoryDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        categoryId={categoryId}
        subcategory={editingSubcategory}
        categoryDefaultAdmin={categoryDefaultAdmin}
      />
    </div>
  );
}

