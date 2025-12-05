"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GroupSettingsSection } from "./GroupSettingsSection";
import { GroupTicketsList } from "./GroupTicketsList";


interface Ticket {
  id: number;
  status: string | null;
  description: string | null;
  location?: string | null;
  category_name?: string | null;
  due_at?: Date | string | null;
  resolution_due_at?: Date | string | null;
  metadata?: {
    tatDate?: string;
    tat?: string;
  } | null;
  created_at: Date | string;
  updated_at?: Date | string | null;
}

interface Committee {
  id: number;
  name: string;
  description: string | null;
}

interface TicketGroup {
  id: number;
  name: string;
  description: string | null;
  tickets: Ticket[];
  ticketCount: number;
  committee_id?: number | null;
  committee?: Committee | null;
}

interface ManageGroupTicketsDialogProps {
  group: TicketGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ManageGroupTicketsDialog({
  group,
  open,
  onOpenChange,
  onSuccess,
}: ManageGroupTicketsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedTicketsToRemove, setSelectedTicketsToRemove] = useState<number[]>([]);
  const [currentGroup, setCurrentGroup] = useState<TicketGroup | null>(group);
  const currentGroupRef = useRef<TicketGroup | null>(group);
  const [committees, setCommittees] = useState<Array<{ id: number; name: string; description: string | null }>>([]);
  const [loadingCommittees, setLoadingCommittees] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentGroupRef.current = currentGroup;
  }, [currentGroup]);

  // Update currentGroup when group prop changes
  useEffect(() => {
    setCurrentGroup(group);
  }, [group]);

  const fetchCommittees = useCallback(async () => {
    try {
      setLoadingCommittees(true);
      const response = await fetch("/api/committees");
      if (response.ok) {
        const data = await response.json();
        setCommittees(data.committees || []);
      }
    } catch (error) {
      console.error("Error fetching committees:", error);
    } finally {
      setLoadingCommittees(false);
    }
  }, []);

  const fetchGroupData = useCallback(async () => {
    if (!currentGroup?.id) return;

    try {
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        next: { revalidate: 30 }, // Cache for 30 seconds instead of no-store
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const updatedGroup = await response.json();
          // Only update if the group structure actually changed (avoid infinite loop)
          setCurrentGroup(prev => {
            if (prev && prev.id === updatedGroup.id && prev.ticketCount === updatedGroup.ticketCount) {
              // Only update tickets array if it changed
              const ticketsChanged = JSON.stringify(prev.tickets) !== JSON.stringify(updatedGroup.tickets);
              return ticketsChanged ? updatedGroup : prev;
            }
            return updatedGroup;
          });
        } else {
          console.error("Server returned non-JSON response when fetching group");
        }
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    }
  }, [currentGroup?.id]);


  // Fetch committees when dialog opens
  useEffect(() => {
    if (open) {
      fetchCommittees();
    }
  }, [open, fetchCommittees]);

  // Fetch group data when dialog opens
  useEffect(() => {
    if (open && currentGroup?.id) {
      fetchGroupData();
    } else {
      // Reset state when dialog closes
      setSelectedTicketsToRemove([]);
    }
  }, [open, currentGroup, fetchGroupData]);

  const handleRemoveTickets = useCallback(async () => {
    if (!currentGroup || selectedTicketsToRemove.length === 0) {
      toast.error("Please select tickets to remove");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${selectedTicketsToRemove.length} ticket(s) from this group?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeTicketIds: selectedTicketsToRemove,
        }),
      });

      if (response.ok) {
        toast.success(`Removed ${selectedTicketsToRemove.length} ticket(s) from group`);
        setSelectedTicketsToRemove([]);
        // Refresh group data to reflect changes
        await fetchGroupData();
        onSuccess?.();
        // Don't close dialog automatically - let user continue managing
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to remove tickets from group");
        } else {
          toast.error(`Failed to remove tickets from group (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error removing tickets from group:", error);
      toast.error("Failed to remove tickets from group");
    } finally {
      setLoading(false);
    }
  }, [currentGroup, selectedTicketsToRemove, onSuccess, fetchGroupData]);

  const toggleTicketToRemove = (ticketId: number) => {
    setSelectedTicketsToRemove(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleSetGroupTAT = useCallback(async (tat: string) => {
    if (!currentGroup?.id) {
      toast.error("Group not found");
      return;
    }

    try {
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupTAT: tat,
        }),
      });

      if (response.ok) {
        await fetchGroupData();
        onSuccess?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to set group TAT");
        } else {
          throw new Error(`Failed to set group TAT (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error setting group TAT:", error);
      throw error;
    }
  }, [currentGroup, fetchGroupData, onSuccess]);

  const handleSetCommittee = useCallback(async (committeeId: number | null) => {
    if (!currentGroup?.id) {
      toast.error("Group not found");
      return;
    }

    try {
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committee_id: committeeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentGroup(prev => prev ? { ...prev, committee_id: committeeId, committee: data.committee } : null);
        await fetchGroupData();
        onSuccess?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to assign committee");
        } else {
          throw new Error(`Failed to assign committee (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error setting committee:", error);
      throw error;
    }
  }, [currentGroup, fetchGroupData, onSuccess]);

  if (!currentGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl">Manage Tickets: {currentGroup.name}</DialogTitle>
          <DialogDescription className="text-sm mt-2">
            Remove tickets from this group and manage its committee assignment and TAT. Currently <span className="font-semibold">{currentGroup.ticketCount}</span> ticket{currentGroup.ticketCount !== 1 ? "s" : ""} in group.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-4 py-4">
            <GroupSettingsSection
              groupId={currentGroup.id}
              currentCommittee={currentGroup.committee || null}
              committees={committees}
              loadingCommittees={loadingCommittees}
              onCommitteeChange={handleSetCommittee}
              onTATChange={handleSetGroupTAT}
            />

            <GroupTicketsList
              tickets={currentGroup.tickets}
              selectedTickets={selectedTicketsToRemove}
              onToggleTicket={toggleTicketToRemove}
              onRemoveTickets={handleRemoveTickets}
              loading={loading}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4 px-6 pb-6 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              💡 Tip: Click the external link icon to view full ticket details. Use Bulk Actions from the groups page to comment or close all tickets in this group.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
