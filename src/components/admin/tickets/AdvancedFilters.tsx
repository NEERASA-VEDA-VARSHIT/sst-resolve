"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdvancedFiltersProps {
  location: string;
  userNumber: string;
  createdFrom: string;
  createdTo: string;
  onLocationChange: (value: string) => void;
  onUserNumberChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  locationOptions: string[];
}

export function AdvancedFilters({
  location,
  userNumber,
  createdFrom,
  createdTo,
  onLocationChange,
  onUserNumberChange,
  onCreatedFromChange,
  onCreatedToChange,
  locationOptions,
}: AdvancedFiltersProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-primary">Advanced Filters</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="location" className="text-xs mb-1.5 block">Location/Vendor</Label>
          {locationOptions.length > 0 ? (
            <Select value={location || undefined} onValueChange={(value) => onLocationChange(value || "")}>
              <SelectTrigger id="location" className="w-full h-9 text-sm">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="location"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="Enter location or vendor name"
              className="h-9 text-sm"
            />
          )}
        </div>
        <div>
          <Label htmlFor="user" className="text-xs mb-1.5 block">User Number</Label>
          <Input
            id="user"
            value={userNumber}
            onChange={(e) => onUserNumberChange(e.target.value)}
            placeholder="Enter user number"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="from" className="text-xs mb-1.5 block">Created From</Label>
          <Input
            id="from"
            type="date"
            value={createdFrom}
            onChange={(e) => onCreatedFromChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="to" className="text-xs mb-1.5 block">Created To</Label>
          <Input
            id="to"
            type="date"
            value={createdTo}
            onChange={(e) => onCreatedToChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
