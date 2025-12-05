"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, AlertCircle } from "lucide-react";
import type { CategorySchema } from "../types";

interface CategorySelectorProps {
  schemas: CategorySchema[];
  value: number | null;
  error?: string;
  onChange: (categoryId: number | null) => void;
  onSubcategoryReset: () => void;
}

export function CategorySelector({
  schemas,
  value,
  error,
  onChange,
  onSubcategoryReset,
}: CategorySelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Label className="text-sm sm:text-base font-semibold">
          Category <span className="text-destructive">*</span>
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Choose the category for your issue.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Select
        value={value?.toString() || ""}
        onValueChange={(v) => {
          const id = v ? Number(v) : null;
          onChange(id);
          onSubcategoryReset();
        }}
      >
        <SelectTrigger
          id="category"
          className={`w-full h-11 ${error ? "border-destructive" : ""}`}
        >
          <SelectValue
            placeholder={schemas.length === 0 ? "No categories" : "Select category"}
          />
        </SelectTrigger>
        <SelectContent>
          {schemas.map((s) => (
            <SelectItem key={s.category.id} value={String(s.category.id)}>
              {s.category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
