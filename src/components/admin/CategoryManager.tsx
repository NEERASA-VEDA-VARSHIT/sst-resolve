"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { CategoryDialog } from "./CategoryDialog";
import { SubcategoryManager } from "./SubcategoryManager";
import { EscalationManager } from "./EscalationManager";
import { CategoryAssignmentsManager } from "./CategoryAssignmentsManager";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sla_hours: number;
  display_order: number;
  active: boolean;
  default_authority?: number | null;
  domain_id?: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface CategoryManagerProps {
  initialCategories: Category[];
}

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/admin/categories");
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setCategories(data);
        } else {
          console.error("Server returned non-JSON response when fetching categories");
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This will also delete all subcategories and fields.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Category deleted successfully");
        await fetchCategories();
        if (selectedCategory?.id === category.id) {
          setSelectedCategory(null);
        }
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to delete category");
        } else {
          toast.error(`Failed to delete category (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  const handleDialogClose = async (saved: boolean) => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    if (saved) {
      await fetchCategories();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">All Categories</h3>
          <p className="text-sm text-muted-foreground">
            {categories.length} active categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={handleCreateCategory} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Category
        </Button>
      </div>

      {selectedCategory ? (
        <Tabs defaultValue="subcategories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subcategories">Subcategories & Fields</TabsTrigger>
            <TabsTrigger value="assignments">Admin Assignments</TabsTrigger>
            {(selectedCategory.name === "Hostel" || selectedCategory.name === "College") && (
              <TabsTrigger value="escalation">Escalation Rules</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="subcategories" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">{selectedCategory.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory.description || "No description"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditCategory(selectedCategory)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Category
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Back to List
                </Button>
              </div>
            </div>
            <SubcategoryManager
              categoryId={selectedCategory.id}
              categoryDefaultAdmin={selectedCategory.default_authority}
            />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">{selectedCategory.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Manage admin assignments for this category
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Back to List
              </Button>
            </div>
            <CategoryAssignmentsManager categoryId={selectedCategory.id} />
          </TabsContent>

          {(selectedCategory.name === "Hostel" || selectedCategory.name === "College") && (
            <TabsContent value="escalation" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold">{selectedCategory.name} Escalation Rules</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure escalation chain for tickets in this category. Rules are processed in order by level.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Back to List
                </Button>
              </div>
              <EscalationManager
                categoryName={selectedCategory.name}
                categoryId={selectedCategory.domain_id || 0}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="grid gap-4">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{category.name}</h4>
                        {!category.active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description || "No description"}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>SLA: {category.sla_hours}h</span>
                        {category.icon && (
                          <span className="flex items-center gap-1">
                            Icon: {category.icon}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(category)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        category={editingCategory}
      />
    </div>
  );
}

