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

  validation_rules: any;
  display_order: number;

  // FIX: allow undefined
  options?: FieldOption[] | undefined;
}

interface DynamicFieldRendererProps {
  field: Field;
  value: any;
  onChange: (value: any) => void;
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
            value={value ?? ""}
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
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            rows={4}
            className={cn(error && "border-destructive")}
          />
        );

      case "select":
        return (
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger className={cn(error && "border-destructive")}>
              <SelectValue placeholder={placeholder || "Select"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option, idx) => {
                // Use id if available, otherwise create a stable key from field.id + index
                const uniqueKey = option.id ? `opt-${option.id}` : `${field.id}-opt-${idx}`;
                return (
                  <SelectItem key={uniqueKey} value={option.value}>
                    {option.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );

      case "date": {
        const formatted = (() => {
          if (!value) return "";
          if (typeof value === "string") return value.split("T")[0];
          try {
            return new Date(value).toISOString().split("T")[0];
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
            value={value === 0 ? "0" : value ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder={placeholder}
            className={cn(error && "border-destructive")}
            min={field.validation_rules?.min}
            max={field.validation_rules?.max}
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
            value={value ?? ""}
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