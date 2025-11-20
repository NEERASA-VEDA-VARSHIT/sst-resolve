"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { FieldDialog } from "./FieldDialog";
import { toast } from "sonner";

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

interface FieldBuilderProps {
  subcategoryId: number;
  initialFields: Field[];
  onFieldsChange: () => void;
  subcategoryDefaultAdmin?: number | null;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Text Area",
  select: "Dropdown",
  date: "Date",
  number: "Number",
  boolean: "Yes/No",
  upload: "File Upload",
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-800",
  textarea: "bg-purple-100 text-purple-800",
  select: "bg-green-100 text-green-800",
  date: "bg-orange-100 text-orange-800",
  number: "bg-pink-100 text-pink-800",
  boolean: "bg-yellow-100 text-yellow-800",
  upload: "bg-gray-100 text-gray-800",
};

export function FieldBuilder({
  subcategoryId,
  initialFields,
  onFieldsChange,
  subcategoryDefaultAdmin,
}: FieldBuilderProps) {
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  const handleCreateField = () => {
    setEditingField(null);
    setIsDialogOpen(true);
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setIsDialogOpen(true);
  };

  const handleDeleteField = async (field: Field) => {
    if (!confirm(`Are you sure you want to permanently delete field "${field.name}"?\n\nThis will:\n• Remove the field from new ticket forms\n• Archive the field if existing tickets use it\n• Preserve data for old tickets\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      toast.loading("Deleting field...", { id: "delete-field" });
      
      const response = await fetch(`/api/admin/fields/${field.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.archived) {
          toast.success(`Field "${result.field_name}" deleted and archived. ${result.ticket_count} existing tickets preserved.`, { id: "delete-field" });
        } else {
          toast.success(`Field "${result.field_name}" deleted permanently (no tickets were using it).`, { id: "delete-field" });
        }
        await onFieldsChange(); // Ensure the refetch completes
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete field", { id: "delete-field" });
      }
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Failed to delete field", { id: "delete-field" });
    }
  };

  const handleDialogClose = async (saved: boolean) => {
    setIsDialogOpen(false);
    setEditingField(null);
    if (saved) {
      onFieldsChange();
    }
  };

  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Form Fields</h4>
          <p className="text-xs text-muted-foreground">
            Add custom fields that will appear when creating tickets in this subcategory
          </p>
        </div>
        <Button onClick={handleCreateField} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </Button>
      </div>

      {sortedFields.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            No fields yet. Add fields to collect specific information.
          </p>
          <Button onClick={handleCreateField} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedFields.map((field) => (
            <Card key={field.id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-sm font-medium">
                        {field.name}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className={FIELD_TYPE_COLORS[field.field_type] || ""}
                      >
                        {FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                      </Badge>
                    </div>
                    {field.help_text && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.help_text}
                      </p>
                    )}
                    {field.field_type === "select" && field.options && field.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {field.options.map((opt) => (
                          <Badge key={opt.id} variant="outline" className="text-xs">
                            {opt.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEditField(field)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteField(field)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <FieldDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        subcategoryId={subcategoryId}
        field={editingField}
        subcategoryDefaultAdmin={subcategoryDefaultAdmin}
      />
    </div>
  );
}

