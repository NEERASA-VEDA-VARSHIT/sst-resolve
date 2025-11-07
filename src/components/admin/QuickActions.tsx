"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle2, Clock, AlertTriangle, X, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface QuickActionsProps {
  selectedTickets: number[];
  onBulkAction?: () => void;
}

export function QuickActions({ selectedTickets, onBulkAction }: QuickActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleBulkStatus = async (status: string) => {
    if (selectedTickets.length === 0) {
      toast.error("Please select at least one ticket");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets/bulk-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedTickets,
          status,
        }),
      });

      if (response.ok) {
        toast.success(`${selectedTickets.length} ticket(s) ${status} successfully`);
        router.refresh();
        if (onBulkAction) onBulkAction();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to update tickets" }));
        toast.error(error.error || "Failed to update tickets");
      }
    } catch (error) {
      console.error("Error updating tickets:", error);
      toast.error("Failed to update tickets. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (selectedTickets.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
      <div className="flex-1">
        <p className="text-sm font-medium">
          {selectedTickets.length} ticket{selectedTickets.length !== 1 ? "s" : ""} selected
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            <MoreVertical className="w-4 h-4 mr-2" />
            Quick Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleBulkStatus("closed")}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Closed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleBulkStatus("resolved")}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Resolved
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleBulkStatus("in_progress")}>
            <Clock className="w-4 h-4 mr-2" />
            Mark as In Progress
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

