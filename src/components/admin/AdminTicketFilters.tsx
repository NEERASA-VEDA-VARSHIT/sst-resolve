"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, X, ChevronDown, ChevronUp, Clock, RotateCcw, AlertTriangle, Building2, GraduationCap, ArrowUpDown } from "lucide-react";
// Removed static LOCATIONS import - now fetching from database
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

export function AdminTicketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Fetch filter options from database
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("search") || "");
  const [category, setCategory] = useState<string>(searchParams.get("category") || "");
  const [subcategory, setSubcategory] = useState<string>(searchParams.get("subcategory") || "");
  const [location, setLocation] = useState<string>(searchParams.get("location") || "");
  const [tat, setTat] = useState<string>(searchParams.get("tat") || "");
  const [status, setStatus] = useState<string>("");
  
  
  // Fetch filter options from API
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoadingFilters(true);
        
        // Fetch statuses
        const statusRes = await fetch("/api/filters/statuses");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStatusOptions(statusData.statuses || []);
        }
        
        // Fetch categories
        const categoryRes = await fetch("/api/filters/categories");
        if (categoryRes.ok) {
          const categoryData = await categoryRes.json();
          setCategoryOptions(categoryData.categories || []);
        }
      } catch (error) {
        console.error("Error fetching filters:", error);
      } finally {
        setLoadingFilters(false);
      }
    };
    
    fetchFilters();
  }, []);
  const [createdFrom, setCreatedFrom] = useState<string>(searchParams.get("from") || "");
  const [createdTo, setCreatedTo] = useState<string>(searchParams.get("to") || "");
  const [userNumber, setUserNumber] = useState<string>(searchParams.get("user") || "");
  const [sort, setSort] = useState<string>(searchParams.get("sort") || "newest");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Get subcategories for selected category from database
  const subcategoryOptions = useMemo(() => {
    if (!category) return [] as Array<{ value: string; label: string; id: number }>;
    const selectedCategory = categoryOptions.find(cat => cat.value === category);
    return selectedCategory?.subcategories || [];
  }, [category, categoryOptions]);

  // Fetch location options from database when category/subcategory changes
  useEffect(() => {
    const fetchLocations = async () => {
      if (!category) {
        setLocationOptions([]);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("category", category);
        if (subcategory) {
          params.set("subcategory", subcategory);
        }

        const locationRes = await fetch(`/api/filters/locations?${params.toString()}`);
        if (locationRes.ok) {
          const locationData = await locationRes.json();
          setLocationOptions(locationData.locations || []);
        } else {
          setLocationOptions([]);
        }
      } catch (error) {
        console.error("Error fetching locations:", error);
        setLocationOptions([]);
      }
    };

    fetchLocations();
  }, [category, subcategory]);

  useEffect(() => {
    setSearchQuery(searchParams.get("search") || "");
    setCategory(searchParams.get("category") || "");
    setSubcategory(searchParams.get("subcategory") || "");
    setLocation(searchParams.get("location") || "");
    setTat(searchParams.get("tat") || "");
    const urlStatus = searchParams.get("status") || "";
    // Only set status filter if it's valid and options are loaded
    if (urlStatus && statusOptions.length > 0) {
      const validStatuses = statusOptions.map(s => s.value);
      setStatus(validStatuses.includes(urlStatus) ? urlStatus : "");
    } else if (!urlStatus) {
      setStatus("");
    }
    setCreatedFrom(searchParams.get("from") || "");
    setCreatedTo(searchParams.get("to") || "");
    setUserNumber(searchParams.get("user") || "");
    setSort(searchParams.get("sort") || "newest");
  }, [searchParams, statusOptions]);

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = [];
    if (searchQuery) filters.push({ key: "search", label: "Search", value: searchQuery });
    if (category) filters.push({ key: "category", label: "Category", value: category });
    if (subcategory) filters.push({ key: "subcategory", label: "Subcategory", value: subcategory });
    if (location) filters.push({ key: "location", label: "Location", value: location });
    if (tat) filters.push({ key: "tat", label: "TAT", value: tat });
    if (status) filters.push({ key: "status", label: "Status", value: status });
    if (createdFrom) filters.push({ key: "from", label: "From", value: createdFrom });
    if (createdTo) filters.push({ key: "to", label: "To", value: createdTo });
    if (userNumber) filters.push({ key: "user", label: "User", value: userNumber });
    if (sort && sort !== "newest") filters.push({ key: "sort", label: "Sort", value: sort });
    return filters;
  }, [searchQuery, category, subcategory, location, tat, status, createdFrom, createdTo, userNumber, sort]);

  const removeFilter = useCallback((key: string) => {
    const params = new URLSearchParams();
    
    // Build params from current state, excluding the removed filter
    if (key !== "search" && searchQuery) params.set("search", searchQuery);
    if (key !== "category" && category) params.set("category", category);
    if (key !== "subcategory" && subcategory) params.set("subcategory", subcategory);
    if (key !== "location" && location) params.set("location", location);
    if (key !== "tat" && tat) params.set("tat", tat);
    if (key !== "status" && status) params.set("status", status);
    if (key !== "from" && createdFrom) params.set("from", createdFrom);
    if (key !== "to" && createdTo) params.set("to", createdTo);
    if (key !== "user" && userNumber) params.set("user", userNumber);
    if (key !== "sort" && sort && sort !== "newest") params.set("sort", sort);
    
    // Update state
    switch (key) {
      case "search": setSearchQuery(""); break;
      case "category": setCategory(""); break;
      case "subcategory": setSubcategory(""); break;
      case "location": setLocation(""); break;
      case "tat": setTat(""); break;
      case "status": setStatus(""); break;
      case "from": setCreatedFrom(""); break;
      case "to": setCreatedTo(""); break;
      case "user": setUserNumber(""); break;
      case "sort": setSort("newest"); break;
    }
    
    // Apply filters immediately
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [searchQuery, category, subcategory, location, tat, status, createdFrom, createdTo, userNumber, sort, pathname, router]);

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
    if (location) params.set("location", location);
    if (tat) params.set("tat", tat);
    if (status) params.set("status", status);
    if (createdFrom) params.set("from", createdFrom);
    if (createdTo) params.set("to", createdTo);
    if (userNumber) params.set("user", userNumber);
    if (sort && sort !== "newest") params.set("sort", sort);
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [searchQuery, category, subcategory, location, tat, status, createdFrom, createdTo, userNumber, sort, pathname, router]);

  const reset = useCallback(() => {
    setSearchQuery("");
    setCategory("");
    setSubcategory("");
    setLocation("");
    setTat("");
    setStatus("");
    setCreatedFrom("");
    setCreatedTo("");
    setUserNumber("");
    setSort("newest");
    router.push(pathname);
  }, [pathname, router]);

  // Quick action handlers
  const handleTatToday = useCallback(() => {
    setTat(tat === "today" ? "" : "today");
    apply();
  }, [tat, apply]);

  const handleTatDue = useCallback(() => {
    setTat(tat === "due" ? "" : "due");
    apply();
  }, [tat, apply]);

  const handleCategoryHostel = useCallback(() => {
    setCategory(category === "Hostel" ? "" : "Hostel");
    apply();
  }, [category, apply]);

  const handleCategoryCollege = useCallback(() => {
    setCategory(category === "College" ? "" : "College");
    apply();
  }, [category, apply]);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Filters & Search
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilters.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-7">
                <RotateCcw className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Collapsed View - Always Visible */}
      <CardContent className={isExpanded ? "space-y-4" : "pb-3"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by ticket ID, description, user number, or subcategory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Active Filters and Quick Actions - Always Visible */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {activeFilters.length > 0 && (
            <>
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="gap-1 pr-1 text-xs h-5">
                  <span className="text-xs">{filter.label}: {filter.value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-3 w-3 p-0 hover:bg-transparent"
                    onClick={() => removeFilter(filter.key)}
                  >
                    <X className="w-2.5 h-2.5" />
                  </Button>
                </Badge>
              ))}
              {activeFilters.length > 0 && <Separator orientation="vertical" className="h-4" />}
            </>
          )}
          
          {/* Quick Actions - Always Visible */}
          <button
            onClick={handleTatToday}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              tat === "today"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-background hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-border"
            )}
          >
            <Clock className="w-3 h-3" />
            TAT Today
          </button>
          <button
            onClick={handleTatDue}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              tat === "due"
                ? "bg-red-500 text-white shadow-sm"
                : "bg-background hover:bg-red-50 dark:hover:bg-red-950/20 border border-border"
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </button>
          <button
            onClick={handleCategoryHostel}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              category === "Hostel"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background hover:bg-primary/10 border border-border"
            )}
          >
            <Building2 className="w-3 h-3" />
            Hostel
          </button>
          <button
            onClick={handleCategoryCollege}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              category === "College"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background hover:bg-primary/10 border border-border"
            )}
          >
            <GraduationCap className="w-3 h-3" />
            College
          </button>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <>
            <Separator className="my-4" />

            {/* Filters Section */}
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs font-semibold border-primary/30 bg-primary/5 text-primary px-2 py-1">
                <Filter className="w-3 h-3 mr-1.5" />
                Filters
              </Badge>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="category" className="text-xs mb-1.5 block">Category</Label>
                  <Select value={category || undefined} onValueChange={(value) => setCategory(value || "")}>
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
                    <Select value={subcategory || undefined} onValueChange={(value) => setSubcategory(value || "")}>
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
                      onChange={(e) => setSubcategory(e.target.value)}
                      placeholder="e.g., Mess Quality Issues"
                      className="h-9 text-sm"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="status" className="text-xs mb-1.5 block">Status</Label>
                  <Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
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
                  <Select value={tat || undefined} onValueChange={(value) => setTat(value || "")}>
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

            {/* Sorting Section */}
            <div className="space-y-2 pt-3 border-t">
              <Badge variant="outline" className="text-xs font-semibold border-muted-foreground/30 bg-muted/30 text-muted-foreground px-2 py-1">
                <ArrowUpDown className="w-3 h-3 mr-1.5" />
                Sorting
              </Badge>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="sort" className="text-xs mb-1.5 block">Sort By</Label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger id="sort" className="w-full h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="due-date">Due Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(v => !v)}
                className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10"
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide Advanced
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show Advanced Filters
                  </>
                )}
              </Button>
              <div className="flex gap-2">
                <Button onClick={apply} size="sm" className="h-7 text-xs">
                  <Search className="w-3 h-3 mr-1" />
                  Apply
                </Button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
              <>
                <Separator className="my-3" />
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-primary">Advanced Filters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                    <div>
                      <Label htmlFor="location" className="text-xs mb-1.5 block">Location/Vendor</Label>
                      {locationOptions.length > 0 ? (
                        <Select value={location || undefined} onValueChange={(value) => setLocation(value || "")}>
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
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., Neeladri, GSR"
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="user" className="text-xs mb-1.5 block">User Number</Label>
                      <Input
                        id="user"
                        value={userNumber}
                        onChange={(e) => setUserNumber(e.target.value)}
                        placeholder="e.g., 24bcs10005"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="from" className="text-xs mb-1.5 block">Created From</Label>
                      <Input
                        id="from"
                        type="date"
                        value={createdFrom}
                        onChange={(e) => setCreatedFrom(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="to" className="text-xs mb-1.5 block">Created To</Label>
                      <Input
                        id="to"
                        type="date"
                        value={createdTo}
                        onChange={(e) => setCreatedTo(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


