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
import { Plus, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Field {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  validation_rules: Record<string, unknown> | null;
  display_order: number;
  assigned_admin_id?: string | null;
  options?: FieldOption[];
}

interface FieldOption {
  id?: number;
  label: string;
  value: string;
  display_order?: number;
}

interface AdminUser {
  id: string; // UUID
  name: string;
  email: string;
  domain: string | null;
  scope: string | null;
}

interface FieldDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  subcategoryId: number;
  field?: Field | null;
  subcategoryDefaultAdmin?: string | null; // Admin assigned at subcategory level (UUID)
}

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes/No" },
  { value: "upload", label: "File Upload" },
];

export function FieldDialog({
  open,
  onClose,
  subcategoryId,
  field,
  subcategoryDefaultAdmin,
}: FieldDialogProps) {
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [inheritFromSubcategory, setInheritFromSubcategory] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    field_type: "text",
    required: false,
    placeholder: "",
    help_text: "",
    display_order: 0,
    validation_rules: {},
    assigned_admin_id: null as string | null,
  });
  const [options, setOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    if (open) {
      fetchAdmins();
    }
  }, [open]);

  const fetchAdmins = async () => {
    try {
      setLoadingStaff(true);
      const response = await fetch("/api/admin/list");
      if (response.ok) {
        // Check Content-Type before parsing JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setAdminUsers(data.admins || []);
        } else {
          console.warn("API returned non-JSON response");
        }
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (field) {
      const hasInlineAdmin = field.assigned_admin_id !== null && field.assigned_admin_id !== undefined;
      setInheritFromSubcategory(!hasInlineAdmin);
      setFormData({
        name: field.name || "",
        slug: field.slug || "",
        field_type: field.field_type || "text",
        required: field.required || false,
        placeholder: field.placeholder || "",
        help_text: field.help_text || "",
        display_order: field.display_order || 0,
        validation_rules: field.validation_rules || {},
        assigned_admin_id: field.assigned_admin_id || null,
      });
      setOptions(field.options || []);
    } else {
      setInheritFromSubcategory(true);
      setFormData({
        name: "",
        slug: "",
        field_type: "text",
        required: false,
        placeholder: "",
        help_text: "",
        display_order: 0,
        validation_rules: {},
        assigned_admin_id: null,
      });
      setOptions([]);
    }
  }, [field, open]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const handleAddOption = () => {
    setOptions([...options, { label: "", value: "", display_order: options.length }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, key: "label" | "value", value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    if (key === "label" && !newOptions[index].value) {
      newOptions[index].value = generateSlug(value);
    }
    
    // Note: We allow duplicate values to be typed so users can see the visual warning
    // The validation on submit will prevent saving duplicates
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate select field options
      if (formData.field_type === "select" && options.length === 0) {
        toast.error("Select fields must have at least one option");
        setLoading(false);
        return;
      }

      // Validate for duplicate values (case-insensitive)
      if (formData.field_type === "select") {
        const valueMap = new Map<string, number>();
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const value = (opt.value || generateSlug(opt.label)).trim().toLowerCase();
          if (!value) {
            toast.error(`Option ${i + 1}: Value cannot be empty`);
            setLoading(false);
            return;
          }
          if (valueMap.has(value)) {
            const duplicateIndex = valueMap.get(value)!;
            toast.error(`Duplicate values detected: Options ${duplicateIndex + 1} and ${i + 1} have the same value. Each option must have a unique value.`);
            setLoading(false);
            return;
          }
          valueMap.set(value, i);
        }
      }

      const optionsToSend = options.map((opt, index) => ({
        label: opt.label,
        value: opt.value || generateSlug(opt.label),
        display_order: index,
      }));

      const url = field ? `/api/admin/fields/${field.id}` : "/api/admin/fields";
      const method = field ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          subcategory_id: subcategoryId,
          assigned_admin_id: inheritFromSubcategory ? null : formData.assigned_admin_id,
          options: formData.field_type === "select" ? optionsToSend : undefined,
        }),
      });

      if (response.ok) {
        toast.success(field ? "Field updated successfully" : "Field created successfully");
        onClose(true);
      } else {
        // Check Content-Type before parsing JSON error
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to save field");
        } else {
          toast.error(`Failed to save field (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error saving field:", error);
      toast.error("Failed to save field");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? "Edit Field" : "Create New Field"}</DialogTitle>
          <DialogDescription>
            {field
              ? "Update field configuration. Changes will affect new tickets."
              : "Add a custom field to collect specific information in tickets."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Field Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Vendor, Date, Room Type"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">
                Field ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="e.g., vendor, date, room_type"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="field_type">
                Field Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.field_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, field_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={formData.required}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, required: checked === true }))
              }
            />
            <Label htmlFor="required" className="cursor-pointer">
              Required field
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeholder">Placeholder Text</Label>
            <Input
              id="placeholder"
              value={formData.placeholder}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, placeholder: e.target.value }))
              }
              placeholder="e.g., Select a vendor..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="help_text">Help Text</Label>
            <Textarea
              id="help_text"
              value={formData.help_text}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, help_text: e.target.value }))
              }
              placeholder="Additional instructions for users"
              rows={2}
            />
          </div>

          {formData.field_type === "select" && (
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label>Dropdown Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              </div>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options yet. Add options for the dropdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {options.map((option, index) => {
                    // Check if this option has a duplicate value
                    const normalizedValue = option.value?.trim().toLowerCase() || "";
                    const isDuplicate = normalizedValue && options.some(
                      (opt, idx) => idx !== index && opt.value?.trim().toLowerCase() === normalizedValue
                    );
                    
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Option label"
                            value={option.label}
                            onChange={(e) =>
                              handleOptionChange(index, "label", e.target.value)
                            }
                            className="flex-1"
                          />
                          <div className="flex-1 relative">
                            <Input
                              placeholder="Option value"
                              value={option.value}
                              onChange={(e) =>
                                handleOptionChange(index, "value", e.target.value)
                              }
                              className={cn(
                                "flex-1",
                                isDuplicate && "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {isDuplicate && (
                              <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        {isDuplicate && (
                          <p className="text-xs text-destructive pl-6 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This value is already used by another option. Each option must have a unique value.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inherit_admin_field"
                checked={inheritFromSubcategory}
                onCheckedChange={(checked) => {
                  setInheritFromSubcategory(checked === true);
                  if (checked) {
                    setFormData((prev) => ({ ...prev, assigned_admin_id: null }));
                  }
                }}
              />
              <Label htmlFor="inherit_admin_field" className="cursor-pointer font-medium">
                Inherit admin from subcategory
                {subcategoryDefaultAdmin && (
                  <span className="text-xs text-muted-foreground ml-2 font-normal">
                    (Currently: {adminUsers.find(s => s.id === subcategoryDefaultAdmin)?.name || "Unknown"})
                  </span>
                )}
              </Label>
            </div>
            {!inheritFromSubcategory && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="assigned_admin_id_field">Assign Specific Admin</Label>
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
                  <SelectTrigger id="assigned_admin_id_field">
                    <SelectValue placeholder="Select admin (overrides subcategory default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No admin</SelectItem>
                    {adminUsers.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                        {admin.domain && ` (${admin.domain}${admin.scope ? ` - ${admin.scope}` : ""})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This admin will override the subcategory default for tickets using this field.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : field ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
