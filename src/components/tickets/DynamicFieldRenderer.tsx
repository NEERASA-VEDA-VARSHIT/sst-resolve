"use client";

import { useRef } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageIcon, Trash2, Loader2 } from "lucide-react";
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
  onImageUpload?: (file: File) => Promise<void>;
  imagesUploading?: boolean;
}

/* -----------------------------
   Component
------------------------------ */

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
  onImageUpload,
  imagesUploading = false,
}: DynamicFieldRendererProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

      case "multi_select":
      case "select_multiple":
      case "multiselect":
      case "select": {
        const rules = (field.validation_rules || {}) as { multiSelect?: boolean; allowMultiple?: boolean };
        const normalizedType = (field.field_type || "").toLowerCase();
        // Check if field should allow multiple selections
        // Priority: validation_rules.multiSelect > validation_rules.allowMultiple > field_type
        const allowMultiple =
          rules?.multiSelect === true ||
          rules?.allowMultiple === true ||
          normalizedType === "multi_select" ||
          normalizedType === "multiselect" ||
          normalizedType === "select_multiple";

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
        
        const buildOptionKey = (option: FieldOption, idx: number) => {
          const fieldId = String(field?.id ?? 0);
          const optionId = (option as { id?: number }).id;
          if (optionId !== undefined && optionId !== null) {
            return `opt-${fieldId}-${optionId}`;
          }
          const valueSafe = option.value
            ? String(option.value).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)
            : `val${idx}`;
          return `opt-${fieldId}-idx${idx}-${valueSafe}`;
        };
        
        if (allowMultiple) {
          const selectedValues = Array.isArray(value)
            ? value.map((v) => String(v))
            : value != null
            ? [String(value)]
            : [];

          const toggleValue = (optionValue: string, checked: boolean) => {
            const normalizedOption = String(optionValue);
            let next = selectedValues.filter((v) => v !== normalizedOption);
            if (checked) {
              next = [...next, normalizedOption];
            }
            onChange(next);
          };

          return (
            <div className="space-y-2.5">
              {uniqueOptions.map((option, idx) => {
                const optionValue = option.value;
                const isChecked = selectedValues.includes(optionValue);
                return (
                  <label
                    key={buildOptionKey(option, idx)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-md border transition-colors cursor-pointer",
                      isChecked 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-muted/30 border-muted hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        toggleValue(optionValue, checked === true)
                      }
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-sm font-medium flex-1">
                      {option.label || option.value}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        }

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
                return (
                  <SelectItem key={buildOptionKey(option, idx)} value={option.value}>
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

      case "upload": {
        const images: string[] = Array.isArray(value) ? value : (value ? [String(value)] : []);
        
        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          
          if (onImageUpload) {
            // Use the provided upload handler (from TicketForm)
            // Upload each file sequentially
            for (let i = 0; i < files.length; i++) {
              try {
                await onImageUpload(files[i]);
                // The upload handler updates the form state via setDetail
                // The component will re-render with updated images from value prop
              } catch (err) {
                console.error("Upload failed:", err);
              }
            }
          } else {
            // Fallback: just store file objects (not recommended for production)
            const fileArray = Array.from(files);
            onChange(fileArray);
          }
          
          // Reset input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        };
        
        const removeImage = (imageUrl: string) => {
          const updatedImages = images.filter(img => img !== imageUrl);
          onChange(updatedImages.length > 0 ? updatedImages : []);
        };
        
        return (
          <div className="space-y-3">
            <div className="flex gap-3 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                id={`${field.slug}-file-input`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={imagesUploading}
                className={cn(error && "border-destructive")}
              >
                {imagesUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Upload Image{images.length > 0 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
            
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((imageUrl, idx) => (
                  <div key={idx} className="relative w-28 h-28 rounded overflow-hidden border group">
                    <Image
                      src={imageUrl}
                      alt={`Upload ${idx + 1}`}
                      fill
                      sizes="112px"
                      className="object-cover"
                      style={{ objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => removeImage(imageUrl)}
                      className="absolute top-1 right-1 bg-white/80 p-1 rounded hover:bg-white transition-colors z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {images.length === 0 && field.required && (
              <p className="text-xs text-destructive">At least one image is required</p>
            )}
          </div>
        );
      }

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