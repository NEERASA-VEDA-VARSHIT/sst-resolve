"use client";

import { useState, useEffect } from "react";
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
import { Search, X, Filter, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { TicketStatus } from "@/lib/status/types";

interface CategoryOption {
  value: string;
  label: string;
  id: number;
  subcategories?: {
    value: string;
    label: string;
    id: number;
    sub_subcategories?: {
      value: string;
      label: string;
      id: number;
    }[];
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

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "");
  const [subcategoryFilter, setSubcategoryFilter] = useState(searchParams.get("subcategory") || "");
  const [subSubcategoryFilter, setSubSubcategoryFilter] = useState(searchParams.get("sub_subcategory") || "");
  const [sortBy, setSortBy] = useState(currentSort || "newest");
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [loadingFilters, setLoadingFilters] = useState(false);

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
    setStatusFilter(searchParams.get("status") || "");
    setCategoryFilter(searchParams.get("category") || "");
    setSubcategoryFilter(searchParams.get("subcategory") || "");
    setSubSubcategoryFilter(searchParams.get("sub_subcategory") || "");
    setSortBy(searchParams.get("sort") || currentSort);
  }, [searchParams, currentSort]);

  const applyFilters = (
    search: string,
    status: string,
    category: string,
    subcategory: string,
    subSubcategory: string,
    sort: string,
    dynFilters: Record<string, string>
  ) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    if (category && category !== "all") params.set("category", category);
    if (subcategory && subcategory !== "all") params.set("subcategory", subcategory);
    if (subSubcategory && subSubcategory !== "all") params.set("sub_subcategory", subSubcategory);
    if (sort && sort !== "newest") params.set("sort", sort);

    // Add dynamic filters
    Object.entries(dynFilters).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(`f_${key}`, value);
      }
    });

    router.push(`/student/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    if (onSearch) onSearch(search);
  };

  const handleSearch = () => {
    applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, subSubcategoryFilter, sortBy, dynamicFilters);
  };

  const handleClear = () => {
    setSearchQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setSubSubcategoryFilter("");
    setSortBy("newest");
    setDynamicFilters({});
    applyFilters("", "", "", "", "", "newest", {});
  };

  const hasFilters = searchQuery ||
    (statusFilter && statusFilter !== "all") ||
    (categoryFilter && categoryFilter !== "all") ||
    (subcategoryFilter && subcategoryFilter !== "all") ||
    (subSubcategoryFilter && subSubcategoryFilter !== "all") ||
    (sortBy && sortBy !== "newest") ||
    Object.keys(dynamicFilters).length > 0;

  // Find selected category and subcategory objects
  const selectedCategory = categories.find(c => c.value === categoryFilter);
  const selectedSubcategory = selectedCategory?.subcategories?.find(s => s.value === subcategoryFilter);

  // Get available subcategories and sub-subcategories
  const subcategoriesList = selectedCategory?.subcategories || [];
  const subSubcategoriesList = selectedSubcategory?.sub_subcategories || [];

  // Get dynamic fields for the selected subcategory
  const dynamicFields = selectedSubcategory?.fields || [];

  return (
    <div className="space-y-4">
      {/* Search Input and Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSearch}>Search</Button>
          {hasFilters && (
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={statusFilter || "all"} onValueChange={(value) => {
          const newValue = value === "all" ? "" : value;
          setStatusFilter(newValue);
          applyFilters(searchQuery, newValue, categoryFilter, subcategoryFilter, subSubcategoryFilter, sortBy, dynamicFilters);
        }}>
          <SelectTrigger className="w-full sm:w-[180px] h-10">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter || "all"} onValueChange={(value) => {
          const newValue = value === "all" ? "" : value;
          setCategoryFilter(newValue);
          setSubcategoryFilter("");
          setSubSubcategoryFilter("");
          setDynamicFilters({});
          applyFilters(searchQuery, statusFilter, newValue, "", "", sortBy, {});
        }}>
          <SelectTrigger className="w-full sm:w-[180px] h-10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {!loadingFilters && categories.map((cat) => (
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
            setSubSubcategoryFilter("");
            setDynamicFilters({});
            applyFilters(searchQuery, statusFilter, categoryFilter, newValue, "", sortBy, {});
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <SelectValue placeholder="All Subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcategories</SelectItem>
              {subcategoriesList.map((sub) => (
                <SelectItem key={sub.id} value={sub.value}>
                  {sub.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {subSubcategoriesList.length > 0 && (
          <Select value={subSubcategoryFilter || "all"} onValueChange={(value) => {
            const newValue = value === "all" ? "" : value;
            setSubSubcategoryFilter(newValue);
            applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, newValue, sortBy, dynamicFilters);
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {subSubcategoriesList.map((sub) => (
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
              value={dynamicFilters[field.slug] || "all"}
              onValueChange={(value) => {
                const newValue = value === "all" ? "" : value;
                const newFilters = { ...dynamicFilters, [field.slug]: newValue };
                if (!newValue) delete newFilters[field.slug];
                setDynamicFilters(newFilters);
                applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, subSubcategoryFilter, sortBy, newFilters);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <SelectValue placeholder={`All ${field.name}s`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {field.name}s</SelectItem>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        {/* Sort label and dropdown */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          <span>Sort:</span>
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value);
            applyFilters(searchQuery, statusFilter, categoryFilter, subcategoryFilter, subSubcategoryFilter, value, dynamicFilters);
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-10">
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
