"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  baseUrl?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  totalCount,
  startIndex,
  endIndex,
  baseUrl = "",
}: PaginationControlsProps) {
  const searchParams = useSearchParams();

  // Build URL with pagination params
  const buildUrl = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5; // Show max 5 page numbers

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push("...");
      }

      // Add pages around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null; // Don't show pagination if only 1 page
  }

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-6">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startIndex}</span> to{" "}
        <span className="font-medium">{endIndex}</span> of{" "}
        <span className="font-medium">{totalCount}</span> tickets
      </div>

      <div className="flex items-center gap-2">
        {/* Previous Button */}
        {hasPrev ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildUrl(currentPage - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
        )}

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum, index) => {
            if (pageNum === "...") {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              );
            }

            const isActive = pageNum === currentPage;
            return (
              <Button
                key={pageNum}
                variant={isActive ? "default" : "outline"}
                size="sm"
                asChild={!isActive}
                disabled={isActive}
              >
                {isActive ? (
                  <span>{pageNum}</span>
                ) : (
                  <Link href={buildUrl(pageNum as number)}>{pageNum}</Link>
                )}
              </Button>
            );
          })}
        </div>

        {/* Next Button */}
        {hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildUrl(currentPage + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
