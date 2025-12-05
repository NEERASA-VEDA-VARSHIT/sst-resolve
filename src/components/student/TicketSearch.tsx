"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, ArrowUpDown } from "lucide-react";
import type { TicketStatus } from "@/schemas/status";

interface CategoryOption {
  value: string;
  label: string;
  id: number;
  subcategories?: {
    value: string;
    label: string;
    id: number;
    fields?: {
      id: number;
      name: string;
      slug: string;
      type: string;
      options: { label: string; value: string }[];
    }[];
  }[];
}

interface TicketSearchProps {
  categories?: CategoryOption[];
  currentSort?: string;
  statuses?: TicketStatus[];
  onSearch?: (query: string) => void;
}

export default function TicketSearch({ 
  categories = [], 
  currentSort = "newest", 
  statuses = [], 
  onSearch 
}: TicketSearchProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "");
  const [subcategoryFilter, setSubcategoryFilter] = useState(searchParams.get("subcategory") || "");
  const [sortBy, setSortBy] = useState(currentSort || "newest");
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [loadingFilters] = useState(false);

  // Initialize dynamic filters from URL
  useEffect(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith("f_")) {
        filters[key.replace("f_", "")] = value;
      }
    });
    setDynamicFilters(filters);
  }, [searchParams]);

  // Update local state when URL params change (for back/forward navigation)
  useEffect(() => {
    setSearchQuery(searchParams.get("search") || "");
    // Normalize status filter to lowercase to match stats cards
    const urlStatus = searchParams.get("status") || "";
    setStatusFilter(urlStatus.toLowerCase());
    setCategoryFilter(searchParams.get("category") || "");
    setSubcategoryFilter(searchParams.get("subcategory") || "");
    setSortBy(searchParams.get("sort") || currentSort);
  }, [searchParams, currentSort]);

  // Safety check for dynamicFilters - define early so it can be used throughout the component
  const safeDynamicFilters = dynamicFilters && typeof dynamicFilters === 'object' && !Array.isArray(dynamicFilters) ? dynamicFilters : {};

  const applyFilters = (
    search: string,
    status: string,
    category: string,
    subcategory: string,
    sort: string,
    dynFilters: Record<string, string>
  ) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "all") {
      params.set("status", status);
      params.delete("escalated"); // Remove escalated when selecting status
    }
    if (category && category !== "all") params.set("category", category);
    if (subcategory && subcategory !== "all") params.set("subcategory", subcategory);
    if (sort && sort !== "newest") params.set("sort", sort);

    // Add dynamic filters
    // Safety check: ensure dynFilters is a valid object before calling Object.entries
    const safeDynFilters = dynFilters && typeof dynFilters === 'object' && !Array.isArray(dynFilters) ? dynFilters : {};
    Object.entries(safeDynFilters).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(`f_${key}`, value);
      }
    });

    startTransition(() => {
      router.push(`/student/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    });
    if (onSearch) onSearch(search);
  };

  const handleSearch = () => {
    applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, sortBy, safeDynamicFilters);
  };

  const handleClear = () => {
    setSearchQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setSortBy("newest");
    setDynamicFilters({});
    applyFilters("", "", "", "", "newest", {});
  };

  const hasFilters = searchQuery ||
    (statusFilter && statusFilter !== "all") ||
    (categoryFilter && categoryFilter !== "all") ||
    (subcategoryFilter && subcategoryFilter !== "all") ||
    (sortBy && sortBy !== "newest") ||
    (safeDynamicFilters && Object.keys(safeDynamicFilters).length > 0);

  // Find selected category and subcategory objects
  const selectedCategory = categories.find(c => c.value === categoryFilter);
  const selectedSubcategory = selectedCategory?.subcategories?.find(s => s.value === subcategoryFilter);

  // Get available subcategories
  const subcategoriesList = selectedCategory?.subcategories || [];

  // Get dynamic fields for the selected subcategory
  const dynamicFields = selectedSubcategory?.fields || [];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search Input and Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 text-sm sm:text-base h-9 sm:h-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSearch} className="text-sm sm:text-base h-9 sm:h-10 flex-1 sm:flex-initial">
            Search
          </Button>
          {hasFilters && (
            <Button variant="outline" onClick={handleClear} className="gap-1 sm:gap-2 text-sm sm:text-base h-9 sm:h-10">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4">
        <Select 
          value={statusFilter || "all"} 
          onValueChange={(value) => {
            const newValue = value === "all" ? "" : value.toLowerCase();
            setStatusFilter(newValue);
            // Apply filters which will update URL and sync with stats cards
            applyFilters(searchQuery, newValue, categoryFilter, subcategoryFilter, sortBy, safeDynamicFilters);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses
              .filter(status => status.value && status.value.trim() !== "")
              .map((status) => {
                // Normalize status value to lowercase to match stats cards URL format
                // Database stores "OPEN", "IN_PROGRESS" but URL uses "open", "in_progress"
                const normalizedValue = status.value.toLowerCase();
                // Map AWAITING_STUDENT to awaiting_student_response for consistency
                const urlValue = normalizedValue === "awaiting_student" 
                  ? "awaiting_student_response" 
                  : normalizedValue;
                return (
                  <SelectItem key={status.value} value={urlValue}>
                    {status.label}
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>

        <Select value={categoryFilter || "all"} onValueChange={(value) => {
          const newValue = value === "all" ? "" : value;
          setCategoryFilter(newValue);
          setSubcategoryFilter("");
          setDynamicFilters({});
          applyFilters(searchQuery, statusFilter, newValue, "", sortBy, {});
        }}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {!loadingFilters && categories
              .filter(cat => cat.value && cat.value.trim() !== "")
              .map((cat) => (
                <SelectItem key={cat.id} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {subcategoriesList.length > 0 && (
          <Select value={subcategoryFilter || "all"} onValueChange={(value) => {
            const newValue = value === "all" ? "" : value;
            setSubcategoryFilter(newValue);
            setDynamicFilters({});
            applyFilters(searchQuery, statusFilter, categoryFilter, newValue, sortBy, {});
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="All Subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcategories</SelectItem>
              {subcategoriesList
                .filter(sub => sub.value && sub.value.trim() !== "")
                .map((sub) => (
                  <SelectItem key={sub.id} value={sub.value}>
                    {sub.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Dynamic Fields */}
        {dynamicFields.map((field) => {
          if (field.type !== "select") return null;
          return (
            <Select
              key={field.id}
              value={safeDynamicFilters[field.slug] || "all"}
              onValueChange={(value) => {
                const newValue = value === "all" ? "" : value;
                const newFilters = { ...safeDynamicFilters, [field.slug]: newValue };
                if (!newValue) delete newFilters[field.slug];
                setDynamicFilters(newFilters);
                applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, sortBy, newFilters);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder={`All ${field.name}s`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {field.name}s</SelectItem>
                {field.options
                  .filter(opt => opt.value && opt.value.trim() !== "")
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          );
        })}

        {/* Sort label and dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground w-full sm:w-auto">
          <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="flex-shrink-0">Sort:</span>
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value);
            applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, value, safeDynamicFilters);
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
