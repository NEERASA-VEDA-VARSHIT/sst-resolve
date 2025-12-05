"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import type { Subcategory } from "../types";

interface SubcategorySelectorProps {
  subcategories: Subcategory[];
  value: number | null;
  error?: string;
  onChange: (subcategoryId: number | null) => void;
}

export function SubcategorySelector({
  subcategories,
  value,
  error,
  onChange,
}: SubcategorySelectorProps) {
  if (subcategories.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className="text-sm sm:text-base font-semibold">
        Subcategory <span className="text-destructive">*</span>
      </Label>
      <Select
        value={value?.toString() || ""}
        onValueChange={(v) => {
          const id = v ? Number(v) : null;
          onChange(id);
        }}
      >
        <SelectTrigger
          id="subcategory"
          className={`w-full h-11 ${error ? "border-destructive" : ""}`}
        >
          <SelectValue placeholder="Select subcategory" />
        </SelectTrigger>
        <SelectContent>
          {subcategories.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
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
