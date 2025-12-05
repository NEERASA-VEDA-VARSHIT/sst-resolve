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
import { useAdmins } from "@/lib/api/admins";
import { useSlugGeneration } from "@/hooks/forms/useSlugGeneration";
import { generateSlug } from "@/lib/utils/slug";
import { FieldOptionsEditor, type FieldOption } from "./FieldOptionsEditor";
import { FieldLogicSection } from "./FieldLogicSection";
import { FieldAdminAssignment } from "./FieldAdminAssignment";

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

export type { FieldOption } from "./FieldOptionsEditor";

// AdminUser type - using Admin from useAdminList hook

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
  // By default, do NOT inherit admin from subcategory; let domain/scope + subcategory
  // logic run first, and only use subcategory default if explicitly chosen.
  const [inheritFromSubcategory, setInheritFromSubcategory] = useState(false);
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

  // Use centralized hooks - FieldDialog uses /api/admin/list endpoint
  const { admins: adminUsersRaw, loading: loadingStaff } = useAdmins("list");
  const adminUsers = (adminUsersRaw ?? []).map((admin) => ({
    ...admin,
    name: admin.name ?? (admin as any).full_name ?? admin.email ?? "Unknown",
  }));
  const safeSubcategoryDefaultAdmin = subcategoryDefaultAdmin ?? null;
  const { slugManuallyEdited, handleNameChange: handleSlugNameChange, handleSlugChange: handleSlugChangeCallback, setManualEdit } = useSlugGeneration("_"); // FieldDialog uses underscore separator

  useEffect(() => {
    if (field) {
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
      setManualEdit(true); // Editing existing field means slug is pre-set
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
      setManualEdit(false); // New field, allow auto-generation
      setLogicSectionOpen(false);
      setManualLogicInput("");
    }
  }, [field, open, setManualEdit]);

  const handleNameChange = (name: string) => {
    handleSlugNameChange(name, formData.slug, (newSlug) => {
      setFormData((prev) => ({
        ...prev,
        name,
        slug: slugManuallyEdited ? prev.slug : newSlug,
      }));
    });
  };

  const handleSlugChange = (slug: string) => {
    handleSlugChangeCallback(slug, (newSlug) => {
      setFormData((prev) => ({
        ...prev,
        slug: newSlug,
      }));
    });
  };

  const handleOptionsChange = (newOptions: FieldOption[]) => {
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
     
  }, [dependsOnSlug, logicBehavior, logicValues]);

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
          if (!opt) {
            toast.error(`Option ${i + 1}: Missing option data`);
            setLoading(false);
            return;
          }
          const value = (opt.value || generateSlug(opt.label, "_")).trim().toLowerCase();
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
        value: opt.value || generateSlug(opt.label, "_"),
        display_order: index,
      }));

      const url = field
        ? `${endpoints.admin.fields}/${field.id}`
        : endpoints.admin.fields;

      const payload = {
        ...formData,
        subcategory_id: subcategoryId,
        assigned_admin_id: inheritFromSubcategory ? null : formData.assigned_admin_id,
        options: CHOICE_FIELD_TYPES.has(formData.field_type) ? optionsToSend : undefined,
      };

      if (field) {
        await api.patch(url, payload);
      } else {
        await api.post(url, payload);
      }

      toast.success(field ? "Field updated successfully" : "Field created successfully");
      onClose(true);
    } catch (error) {
      console.error("Error saving field:", error);
      // Error toast is handled by api client
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

          <FieldOptionsEditor
            options={options}
            onChange={handleOptionsChange}
            fieldType={formData.field_type}
          />

          <FieldLogicSection
            enabled={logicSectionOpen}
            onToggle={handleLogicToggle}
            dependsOnSlug={dependsOnSlug}
            onDependsOnChange={handleDependsOnChange}
            logicBehavior={logicBehavior}
            onLogicBehaviorChange={handleLogicBehaviorChange}
            logicValues={logicValues}
            onLogicValuesChange={handleLogicValuesChange}
            logicRequiredEnabled={logicRequiredEnabled}
            availableValueOptions={availableValueOptions}
            manualLogicInput={manualLogicInput}
            onManualLogicInputChange={handleManualLogicInputChange}
            controllingFields={controllingFields}
            hasControllingFields={hasControllingFields}
          />

          <FieldAdminAssignment
            inheritFromSubcategory={inheritFromSubcategory}
            onInheritChange={(inherit) => {
              setInheritFromSubcategory(inherit);
              if (inherit) {
                setFormData((prev) => ({ ...prev, assigned_admin_id: null }));
              }
            }}
            assignedAdminId={formData.assigned_admin_id}
            onAssignedAdminChange={(adminId) =>
              setFormData((prev) => ({ ...prev, assigned_admin_id: adminId }))
            }
            adminUsers={adminUsers}
            loadingStaff={loadingStaff}
            subcategoryDefaultAdmin={safeSubcategoryDefaultAdmin}
          />

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
