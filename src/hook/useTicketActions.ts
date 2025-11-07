"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TicketStatus } from "@/schema/ticket.schema";

interface UseTicketActionsReturn {
  updateStatus: (ticketId: number, status: TicketStatus) => Promise<boolean>;
  addComment: (ticketId: number, comment: string, isAdmin?: boolean, commentType?: string) => Promise<boolean>;
  setTAT: (ticketId: number, tat: string, markInProgress?: boolean) => Promise<boolean>;
  escalate: (ticketId: number) => Promise<boolean>;
  rate: (ticketId: number, rating: number) => Promise<boolean>;
  reassign: (ticketId: number, assignedTo: string) => Promise<boolean>;
  delete: (ticketId: number) => Promise<boolean>;
  loading: string | null;
}

/**
 * Custom hook for ticket actions
 * Centralizes all ticket operations (status, TAT, comments, etc.)
 */
export function useTicketActions(): UseTicketActionsReturn {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const updateStatus = async (ticketId: number, status: TicketStatus): Promise<boolean> => {
    setLoading(`status-${status}`);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success(`Ticket ${status} successfully`);
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to update status" }));
        toast.error(error.error || "Failed to update status");
        return false;
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const addComment = async (
    ticketId: number,
    comment: string,
    isAdmin: boolean = false,
    commentType: string = "student_visible"
  ): Promise<boolean> => {
    setLoading("comment");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, isAdmin, commentType }),
      });

      if (response.ok) {
        toast.success("Comment added successfully");
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to add comment" }));
        toast.error(error.error || "Failed to add comment");
        return false;
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const setTAT = async (ticketId: number, tat: string, markInProgress: boolean = true): Promise<boolean> => {
    setLoading("tat");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/tat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tat, markInProgress }),
      });

      if (response.ok) {
        toast.success("TAT set successfully");
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to set TAT" }));
        toast.error(error.error || "Failed to set TAT");
        return false;
      }
    } catch (error) {
      console.error("Error setting TAT:", error);
      toast.error("Failed to set TAT. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const escalate = async (ticketId: number): Promise<boolean> => {
    setLoading("escalate");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Ticket escalated successfully (Escalation #${data.escalationCount})`);
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to escalate ticket" }));
        toast.error(error.error || "Failed to escalate ticket");
        return false;
      }
    } catch (error) {
      console.error("Error escalating ticket:", error);
      toast.error("Failed to escalate ticket. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const rate = async (ticketId: number, rating: number): Promise<boolean> => {
    setLoading("rate");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (response.ok) {
        toast.success(`Thank you! Your rating of ${rating}/10 has been recorded.`);
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to submit rating" }));
        toast.error(error.error || "Failed to submit rating");
        return false;
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const reassign = async (ticketId: number, assignedTo: string): Promise<boolean> => {
    setLoading("reassign");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
      });

      if (response.ok) {
        toast.success("Ticket reassigned successfully");
        router.refresh();
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to reassign ticket" }));
        toast.error(error.error || "Failed to reassign ticket");
        return false;
      }
    } catch (error) {
      console.error("Error reassigning ticket:", error);
      toast.error("Failed to reassign ticket. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const deleteTicket = async (ticketId: number): Promise<boolean> => {
    setLoading("delete");
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Ticket deleted successfully");
        router.push("/student");
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to delete ticket" }));
        toast.error(error.error || "Failed to delete ticket");
        return false;
      }
    } catch (error) {
      console.error("Error deleting ticket:", error);
      toast.error("Failed to delete ticket. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  };

  return {
    updateStatus,
    addComment,
    setTAT,
    escalate,
    rate,
    reassign,
    delete: deleteTicket,
    loading,
  };
}

