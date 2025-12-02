"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { normalizeStatusForComparison } from "@/lib/utils";

export function StudentActions({ ticketId, currentStatus }: { ticketId: number; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Normalize status for comparison (handles both uppercase enum and lowercase constants)
  const normalizedStatus = normalizeStatusForComparison(currentStatus);

  // Students can reopen closed/resolved tickets
  const canReopen = normalizedStatus === "closed" || normalizedStatus === "resolved";

  // Students can "close" tickets that are not yet fully resolved/closed
  // (under the hood this maps to RESOLVED status)
  const canClose = [
    "open",
    "in_progress",
    "awaiting_student",
    "awaiting_student_response",
    "reopened",
  ].includes(normalizedStatus);

  const handleReopen = async () => {
    if (!canReopen) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REOPENED" }),
      });

      if (response.ok) {
        toast.success("Ticket reopened successfully");
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to reopen ticket" }));
        toast.error(error.error || "Failed to reopen ticket");
      }
    } catch (error) {
      console.error("Error reopening ticket:", error);
      toast.error("Failed to reopen ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!canClose) return;

    setLoading(true);
    try {
      // Use RESOLVED as the canonical status; for students this is shown as "Closed"
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });

      if (response.ok) {
        toast.success("Ticket closed successfully");
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to close ticket" }));
        toast.error(error.error || "Failed to close ticket");
      }
    } catch (error) {
      console.error("Error closing ticket:", error);
      toast.error("Failed to close ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!canReopen && !canClose) {
    return null;
  }

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-1">
              {canClose && !canReopen
                ? "Close Ticket"
                : canReopen && !canClose
                ? "Reopen Ticket"
                : "Manage Ticket"}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {canClose && !canReopen &&
                "If you opened this ticket by mistake or the issue is no longer relevant, you can close it."}
              {canReopen && !canClose &&
                "If your issue wasn't resolved, you can reopen this ticket for further assistance."}
              {canClose && canReopen &&
                "You can close this ticket if it's no longer needed, or reopen it if the issue persists."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {canClose && (
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-red-300 text-red-700 hover:bg-red-100 dark:hover:bg-red-900 whitespace-nowrap"
                size="lg"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {loading ? "Processing..." : "Close Ticket"}
              </Button>
            )}
            {canReopen && (
              <Button
                variant="outline"
                onClick={handleReopen}
                disabled={loading}
                className="border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 whitespace-nowrap"
                size="lg"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {loading ? "Processing..." : "Reopen Ticket"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
