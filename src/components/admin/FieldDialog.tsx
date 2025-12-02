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
  availableFields: Field[];
}

type LogicValidationRules = {
  dependsOn?: string;
  showWhenValue?: string | string[];
  hideWhenValue?: string | string[];
  requiredWhenValue?: string | string[];
  multiSelect?: boolean;
  [key: string]: unknown;
};

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Dropdown" },
  { value: "multi_select", label: "Multi-select (checkboxes)" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes/No" },
  { value: "upload", label: "File Upload" },
];

const CHOICE_FIELD_TYPES = new Set(["select", "multi_select"]);

export function FieldDialog({
  open,
  onClose,
  subcategoryId,
  field,
  subcategoryDefaultAdmin,
  availableFields,
}: FieldDialogProps) {
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  // By default, do NOT inherit admin from subcategory; let domain/scope + subcategory
  // logic run first, and only use subcategory default if explicitly chosen.
  const [inheritFromSubcategory, setInheritFromSubcategory] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
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
  const [logicSectionOpen, setLogicSectionOpen] = useState(false);
  const [manualLogicInput, setManualLogicInput] = useState("");

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
      const hasInlineAdmin =
        field.assigned_admin_id !== null && field.assigned_admin_id !== undefined;
      const initialRules: LogicValidationRules = {
        ...((field.validation_rules || {}) as LogicValidationRules),
        ...(field.field_type === "multi_select" ? { multiSelect: true } : {}),
      };
      // If there is an explicit admin on the field, do NOT inherit.
      // If there isn't, still default to NOT inheriting; user must opt in.
      setInheritFromSubcategory(false);
      setFormData({
        name: field.name || "",
        slug: field.slug || "",
        field_type: field.field_type || "text",
        required: field.required || false,
        placeholder: field.placeholder || "",
        help_text: field.help_text || "",
        display_order: field.display_order || 0,
        validation_rules: initialRules,
        assigned_admin_id: field.assigned_admin_id || null,
      });
      setOptions(field.options || []);
      setSlugManuallyEdited(true); // Editing existing field means slug is pre-set
      setLogicSectionOpen(Boolean(initialRules.dependsOn));
      const initialValues = toArray(
        (initialRules.showWhenValue as string | string[] | undefined) ??
          (initialRules.hideWhenValue as string | string[] | undefined)
      ).join(", ");
      setManualLogicInput(initialValues);
    } else {
      // New field: do not inherit from subcategory by default
      setInheritFromSubcategory(false);
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
      setSlugManuallyEdited(false); // New field, allow auto-generation
      setLogicSectionOpen(false);
      setManualLogicInput("");
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
      slug: slugManuallyEdited ? prev.slug : generateSlug(name),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      slug,
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

  const toArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v));
    if (value === undefined || value === null || value === "") return [];
    return [String(value)];
  };

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].map(String).sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  };

  const patchValidationRules = (patch: Record<string, unknown>) => {
    setFormData((prev) => {
      const current: LogicValidationRules = {
        ...((prev.validation_rules || {}) as LogicValidationRules),
      };
      for (const [key, value] of Object.entries(patch)) {
        const shouldDelete =
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "") ||
          (Array.isArray(value) && value.length === 0);
        if (shouldDelete) {
          delete current[key];
        } else {
          current[key] = value;
        }
      }
      return { ...prev, validation_rules: current };
    });
  };

  const serializeRuleValues = (values: string[]) => {
    if (!values || values.length === 0) return undefined;
    if (values.length === 1) return values[0];
    return values;
  };

  const handleFieldTypeChange = (value: string) => {
    setFormData((prev) => {
      const nextRules = { ...(prev.validation_rules || {}) } as Record<string, unknown>;
      if (value === "multi_select") {
        nextRules.multiSelect = true;
      } else {
        delete nextRules.multiSelect;
      }
      return {
        ...prev,
        field_type: value,
        validation_rules: nextRules,
      };
    });

    if (!CHOICE_FIELD_TYPES.has(value)) {
      setOptions([]);
    }
  };

  const validationRules = (formData.validation_rules || {}) as LogicValidationRules;
  const dependsOnSlug =
    typeof validationRules.dependsOn === "string" ? validationRules.dependsOn : "";
  const showValues = toArray(validationRules.showWhenValue);
  const hideValues = toArray(validationRules.hideWhenValue);
  const logicBehavior: "show" | "hide" =
    hideValues.length > 0 && showValues.length === 0 ? "hide" : "show";
  const logicValues = logicBehavior === "show" ? showValues : hideValues;
  const controllingFields = availableFields.filter((candidate) => candidate.id !== field?.id);
  const controllingField =
    controllingFields.find((candidate) => candidate.slug === dependsOnSlug) || null;
  const hasControllingFields = controllingFields.length > 0;
  const requiredRuleValues = toArray(validationRules.requiredWhenValue);
  const logicRequiredEnabled =
    logicBehavior === "show" &&
    logicValues.length > 0 &&
    requiredRuleValues.length > 0 &&
    arraysEqual(requiredRuleValues, logicValues);

  const availableValueOptions =
    controllingField && CHOICE_FIELD_TYPES.has(controllingField.field_type)
      ? (controllingField.options || []).map((opt) => ({
          label: opt.label || opt.value,
          value: opt.value,
        }))
      : controllingField && controllingField.field_type === "boolean"
      ? [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ]
      : [];

  useEffect(() => {
    if (dependsOnSlug) {
      setLogicSectionOpen(true);
    }
  }, [dependsOnSlug]);

  useEffect(() => {
    setManualLogicInput(logicValues.join(", "));
  }, [dependsOnSlug, logicBehavior, logicValues.join("|")]);

  const handleLogicToggle = (enabled: boolean) => {
    if (!enabled) {
      setLogicSectionOpen(false);
      setManualLogicInput("");
      patchValidationRules({
        dependsOn: undefined,
        showWhenValue: undefined,
        hideWhenValue: undefined,
        requiredWhenValue: undefined,
      });
      return;
    }

    if (!hasControllingFields) {
      toast.error("Add another field first before configuring conditional logic.");
      return;
    }

    const defaultFieldSlug = dependsOnSlug || controllingFields[0]?.slug || "";

    if (!defaultFieldSlug) {
      toast.error("No available fields to depend on yet.");
      return;
    }

    setLogicSectionOpen(true);
    patchValidationRules({
      dependsOn: defaultFieldSlug,
      showWhenValue: undefined,
      hideWhenValue: undefined,
      requiredWhenValue: undefined,
    });
  };

  const handleDependsOnChange = (slug: string) => {
    patchValidationRules({
      dependsOn: slug,
      showWhenValue: undefined,
      hideWhenValue: undefined,
      requiredWhenValue: undefined,
    });
  };

  const handleLogicBehaviorChange = (behavior: "show" | "hide") => {
    if (behavior === logicBehavior) return;
    const serialized = serializeRuleValues(logicValues);
    if (behavior === "show") {
      patchValidationRules({
        showWhenValue: serialized,
        hideWhenValue: undefined,
        requiredWhenValue: logicRequiredEnabled ? serialized : undefined,
      });
    } else {
      patchValidationRules({
        hideWhenValue: serialized,
        showWhenValue: undefined,
        requiredWhenValue: undefined,
      });
    }
  };

  const handleLogicValuesChange = (incoming: string[]) => {
    const unique = Array.from(new Set(incoming.map((val) => val.trim()).filter(Boolean)));
    const serialized = serializeRuleValues(unique);
    if (logicBehavior === "show") {
      patchValidationRules({
        showWhenValue: serialized,
        hideWhenValue: undefined,
        requiredWhenValue: logicRequiredEnabled ? serialized : undefined,
      });
    } else {
      patchValidationRules({
        hideWhenValue: serialized,
        showWhenValue: undefined,
        requiredWhenValue: undefined,
      });
    }
  };

  const handleLogicRequiredToggle = (enabled: boolean) => {
    if (logicBehavior !== "show") {
      patchValidationRules({ requiredWhenValue: undefined });
      return;
    }
    if (!enabled) {
      patchValidationRules({ requiredWhenValue: undefined });
      return;
    }
    if (logicValues.length === 0) {
      toast.error("Select at least one value before making the field required.");
      return;
    }
    patchValidationRules({
      requiredWhenValue: serializeRuleValues(logicValues),
    });
  };

  const handleManualLogicInputChange = (text: string) => {
    setManualLogicInput(text);
    const values = text
      .split(",")
      .map((val) => val.trim())
      .filter((val) => val.length > 0);
    handleLogicValuesChange(values);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate select field options
      if (CHOICE_FIELD_TYPES.has(formData.field_type) && options.length === 0) {
        toast.error("Select fields must have at least one option");
        setLoading(false);
        return;
      }

      // Validate for duplicate values (case-insensitive)
      if (CHOICE_FIELD_TYPES.has(formData.field_type)) {
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
          options: CHOICE_FIELD_TYPES.has(formData.field_type) ? optionsToSend : undefined,
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
                onChange={(e) => handleSlugChange(e.target.value)}
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
                onValueChange={handleFieldTypeChange}
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

          {CHOICE_FIELD_TYPES.has(formData.field_type) && (
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
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Conditional Logic (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Show or require this field based on another answer.
                </p>
              </div>
              <Checkbox
                checked={logicSectionOpen}
                disabled={!hasControllingFields}
                onCheckedChange={(checked) => handleLogicToggle(checked === true)}
              />
            </div>
            {!hasControllingFields && (
              <p className="text-xs text-muted-foreground">
                Add another field first to enable conditional logic.
              </p>
            )}
            {logicSectionOpen && hasControllingFields && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Depends on field</Label>
                  <Select value={dependsOnSlug} onValueChange={handleDependsOnChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field to depend on" />
                    </SelectTrigger>
                    <SelectContent>
                      {controllingFields.map((ctrl) => (
                        <SelectItem key={ctrl.id} value={ctrl.slug}>
                          {ctrl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {dependsOnSlug && (
                  <>
                    <div className="space-y-2">
                      <Label>Behavior</Label>
                      <Select value={logicBehavior} onValueChange={(value) => handleLogicBehaviorChange(value as "show" | "hide")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="show">Show this field when values match</SelectItem>
                          <SelectItem value="hide">Hide this field when values match</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Values that {logicBehavior === "show" ? "trigger" : "hide"} this field
                      </Label>
                      {availableValueOptions.length > 0 ? (
                        <div className="space-y-2">
                          {availableValueOptions.map((option) => {
                            const checked = logicValues.includes(option.value);
                            return (
                              <label
                                key={option.value}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(isChecked) => {
                                    const next = isChecked === true
                                      ? [...new Set([...logicValues, option.value])]
                                      : logicValues.filter((val) => val !== option.value);
                                    handleLogicValuesChange(next);
                                  }}
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                          {logicValues.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Select at least one value.
                            </p>
                          )}
                        </div>
                      ) : (
                        <Input
                          value={manualLogicInput}
                          onChange={(e) => handleManualLogicInputChange(e.target.value)}
                          placeholder="Enter values, separated by commas"
                        />
                      )}
                    </div>

                    {logicBehavior === "show" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="logic-required"
                          checked={logicRequiredEnabled}
                          onCheckedChange={(checked) => handleLogicRequiredToggle(checked === true)}
                          disabled={logicValues.length === 0}
                        />
                        <Label
                          htmlFor="logic-required"
                          className={cn(
                            "cursor-pointer",
                            logicValues.length === 0 && "text-muted-foreground"
                          )}
                        >
                          Mark this field as required when the condition is met
                        </Label>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

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
