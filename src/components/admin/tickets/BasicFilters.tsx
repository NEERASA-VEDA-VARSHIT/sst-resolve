"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StatusOption {
  value: string;
  label: string;
  enum: string;
}

interface CategoryOption {
  value: string;
  label: string;
  id: number;
  subcategories: Array<{ value: string; label: string; id: number }>;
}

interface BasicFiltersProps {
  category: string;
  subcategory: string;
  location: string;
  status: string;
  tat: string;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTatChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  subcategoryOptions: Array<{ value: string; label: string; id: number }>;
  locationOptions: string[];
  statusOptions: StatusOption[];
  loadingFilters: boolean;
}

export function BasicFilters({
  category,
  subcategory,
  location,
  status,
  tat,
  onCategoryChange,
  onSubcategoryChange,
  onLocationChange,
  onStatusChange,
  onTatChange,
  categoryOptions,
  subcategoryOptions,
  locationOptions,
  statusOptions,
  loadingFilters,
}: BasicFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="category" className="text-xs mb-1.5 block">Category</Label>
          <Select value={category || undefined} onValueChange={(value) => onCategoryChange(value || "")}>
            <SelectTrigger id="category" className="w-full h-9 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {!loadingFilters && categoryOptions.map((cat) => (
                <SelectItem key={cat.id} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="subcategory" className="text-xs mb-1.5 block">Subcategory</Label>
          {subcategoryOptions.length > 0 ? (
            <Select value={subcategory || undefined} onValueChange={(value) => onSubcategoryChange(value || "")}>
              <SelectTrigger id="subcategory" className="w-full h-9 text-sm">
                <SelectValue placeholder="All Subcategories" />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="subcategory"
              value={subcategory}
              onChange={(e) => onSubcategoryChange(e.target.value)}
              placeholder="Enter subcategory name"
              className="h-9 text-sm"
            />
          )}
        </div>
        <div>
          <Label htmlFor="status" className="text-xs mb-1.5 block">Status</Label>
          <Select value={status || "all"} onValueChange={(value) => onStatusChange(value === "all" ? "" : value)}>
            <SelectTrigger id="status" className="w-full h-9 text-sm">
              <SelectValue placeholder="Any Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              {!loadingFilters && statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tat" className="text-xs mb-1.5 block">TAT</Label>
          <Select value={tat || undefined} onValueChange={(value) => onTatChange(value || "")}>
            <SelectTrigger id="tat" className="w-full h-9 text-sm">
              <SelectValue placeholder="Any TAT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="has">Has TAT</SelectItem>
              <SelectItem value="none">No TAT</SelectItem>
              <SelectItem value="due">Due/Past</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="today">Today</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
