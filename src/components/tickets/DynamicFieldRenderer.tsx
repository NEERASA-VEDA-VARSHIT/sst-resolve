"use client";

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
import { cn } from "@/lib/utils";

/* -----------------------------
   Types - FIXED
------------------------------ */
interface FieldOption {
  id?: number;
  label: string;
  value: string;
}

interface Field {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  
  // FIX: Allow undefined (backend returns it)
  placeholder: string | null | undefined;
  help_text: string | null | undefined;

  validation_rules: Record<string, unknown> | null;
  display_order: number;

  // FIX: allow undefined
  options?: FieldOption[] | undefined;
}

interface DynamicFieldRendererProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

/* -----------------------------
   Component
------------------------------ */

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
}: DynamicFieldRendererProps) {

  const placeholder = field.placeholder ?? ""; // normalize
  const helpText = field.help_text ?? "";

  const renderField = () => {
    switch (field.field_type) {

      case "text":
        return (
          <Input
            id={field.slug}
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            className={cn(error && "border-destructive")}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.slug}
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            rows={4}
            className={cn(error && "border-destructive")}
          />
        );

      case "select": {
        // Filter valid options
        const validOptions = (field.options ?? [])
          .filter(option => option && option.value && typeof option.value === 'string' && option.value.trim() !== "");
        
        // Deduplicate by ID first (if available), then by value+label combination
        // This allows options with the same value but different labels to both appear
        const seen = new Set<string>();
        const uniqueOptions = validOptions.filter(option => {
          // Create unique key: prefer ID if available, otherwise use value+label
          const optionId = (option as { id?: number }).id;
          const key = optionId ? `id:${optionId}` : `val:${option.value}|label:${option.label || option.value}`;
          
          if (seen.has(key)) {
            return false; // Skip duplicate
          }
          seen.add(key);
          return true;
        });
        
        // Normalize the current value to match option values
        // Convert value to string and trim, then find matching option
        const normalizedValue = value != null ? String(value).trim() : "";
        const matchingOption = uniqueOptions.find(opt => {
          // Try exact match first
          if (opt.value === normalizedValue) return true;
          // Try case-insensitive match
          if (opt.value.toLowerCase() === normalizedValue.toLowerCase()) return true;
          // Try trimmed match
          if (opt.value.trim() === normalizedValue) return true;
          return false;
        });
        const selectValue = matchingOption ? matchingOption.value : "";
        
        return (
          <Select value={selectValue} onValueChange={(newValue) => {
            // Ensure we store the exact option value
            onChange(newValue);
          }}>
            <SelectTrigger className={cn(error && "border-destructive")}>
              <SelectValue placeholder={placeholder || "Select"} />
            </SelectTrigger>
            <SelectContent>
              {uniqueOptions.map((option, idx) => {
                // Generate a truly unique key that cannot be misinterpreted
                // Priority: Use option.id if available (most reliable), otherwise use field.id + index + value
                const fieldId = String(field?.id ?? 0);
                const optionId = (option as { id?: number }).id;
                
                // Create a unique key: prefer option ID, fallback to composite key with index
                // Always use index as part of the key to ensure uniqueness even if IDs are missing
                let uniqueKey: string;
                if (optionId !== undefined && optionId !== null) {
                  // Use option ID as primary key (most reliable)
                  uniqueKey = `opt-${fieldId}-${optionId}`;
                } else {
                  // Fallback: use field ID + index + value for uniqueness
                  // Index ensures uniqueness even if values are the same
                  const valueSafe = option.value ? String(option.value).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) : `val${idx}`;
                  uniqueKey = `opt-${fieldId}-idx${idx}-${valueSafe}`;
                }
                
                // Ensure key is always a valid non-empty string
                if (!uniqueKey || typeof uniqueKey !== 'string' || uniqueKey.trim().length === 0) {
                  // Last resort: use field ID + index + timestamp
                  uniqueKey = `opt-${fieldId}-idx${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                }
                
                return (
                  <SelectItem key={uniqueKey} value={option.value}>
                    {option.label || option.value}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      }

      case "date": {
        const formatted = (() => {
          if (!value) return "";
          if (typeof value === "string") return value.split("T")[0];
          try {
            const dateValue = value instanceof Date ? value :
                             typeof value === 'string' ? new Date(value) :
                             typeof value === 'number' ? new Date(value) :
                             null;
            if (dateValue && !isNaN(dateValue.getTime())) {
              return dateValue.toISOString().split("T")[0];
            }
            return "";
          } catch {
            return "";
          }
        })();

        return (
          <Input
            id={field.slug}
            type="date"
            value={formatted}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && "border-destructive")}
          />
        );
      }

      case "number":
        return (
          <Input
            id={field.slug}
            type="number"
            value={typeof value === 'number' ? (value === 0 ? "0" : String(value)) : 
                   typeof value === 'string' ? value : ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder={placeholder}
            className={cn(error && "border-destructive")}
            min={typeof field.validation_rules?.min === 'number' ? field.validation_rules.min : 
                 typeof field.validation_rules?.min === 'string' ? Number(field.validation_rules.min) : undefined}
            max={typeof field.validation_rules?.max === 'number' ? field.validation_rules.max : 
                 typeof field.validation_rules?.max === 'string' ? Number(field.validation_rules.max) : undefined}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.slug}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked === true)}
            />
            <Label htmlFor={field.slug} className="cursor-pointer">
              {placeholder || field.name}
            </Label>
          </div>
        );

      case "upload":
        return (
          <Input
            id={field.slug}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
            className={cn(error && "border-destructive")}
            accept="image/*,.pdf,.doc,.docx"
          />
        );

      default:
        return (
          <Input
            id={field.slug}
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(error && "border-destructive")}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.slug} className="font-medium">
        {field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {renderField()}

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
export default DynamicFieldRenderer;