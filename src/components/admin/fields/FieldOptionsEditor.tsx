"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateSlug } from "@/lib/utils/slug";

export interface FieldOption {
  id?: number;
  label: string;
  value: string;
  display_order?: number;
}

interface FieldOptionsEditorProps {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
  fieldType: string;
}

const CHOICE_FIELD_TYPES = new Set(["select", "multi_select"]);

export function FieldOptionsEditor({
  options,
  onChange,
  fieldType,
}: FieldOptionsEditorProps) {
  if (!CHOICE_FIELD_TYPES.has(fieldType)) {
    return null;
  }

  const handleAddOption = () => {
    onChange([...options, { label: "", value: "", display_order: options.length }]);
  };

  const handleRemoveOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, key: "label" | "value", value: string) => {
    const newOptions = [...options];
    const current = newOptions[index];
    if (!current) return;

    newOptions[index] = { ...current, [key]: value } as FieldOption;
    if (key === "label" && !newOptions[index]?.value) {
      newOptions[index]!.value = generateSlug(value, "_");
    }
    onChange(newOptions);
  };

  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <Label>Dropdown Options</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
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
            const normalizedValue = option.value?.trim().toLowerCase() || "";
            const isDuplicate =
              normalizedValue &&
              options.some(
                (opt, idx) => idx !== index && opt.value?.trim().toLowerCase() === normalizedValue
              );

            return (
              <div key={index} className="space-y-1">
                <div className="flex gap-2 items-center">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Option label"
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, "label", e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Option value"
                      value={option.value}
                      onChange={(e) => handleOptionChange(index, "value", e.target.value)}
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
                    This value is already used by another option. Each option must have a unique
                    value.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
