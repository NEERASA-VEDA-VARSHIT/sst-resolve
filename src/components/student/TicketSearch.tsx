"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function TicketSearch({ onSearch }: { onSearch?: (query: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    
    router.push(`/student/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    if (onSearch) onSearch(searchQuery);
  };

  const handleClear = () => {
    setSearchQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    router.push("/student/dashboard");
    if (onSearch) onSearch("");
  };

  const hasFilters = searchQuery || statusFilter || categoryFilter;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search tickets by ID, description, or subcategory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 pr-10 h-11"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} className="h-11 px-6">
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
        {hasFilters && (
          <Button variant="outline" onClick={handleClear} className="h-11">
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value || "")}>
          <SelectTrigger className="w-full sm:w-[180px] h-10">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_student_response">Awaiting Response</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter || undefined} onValueChange={(value) => setCategoryFilter(value || "")}>
          <SelectTrigger className="w-full sm:w-[180px] h-10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Hostel">Hostel</SelectItem>
            <SelectItem value="College">College</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

