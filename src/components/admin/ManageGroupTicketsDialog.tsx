"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, Package, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
  } | null;
  created_at: Date | string;
}

interface TicketGroup {
  id: number;
  name: string;
  description: string | null;
  tickets: Ticket[];
  ticketCount: number;
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
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([]);
  const [selectedTicketsToAdd, setSelectedTicketsToAdd] = useState<number[]>([]);
  const [selectedTicketsToRemove, setSelectedTicketsToRemove] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<TicketGroup | null>(group);

  // Update currentGroup when group prop changes
  useEffect(() => {
    setCurrentGroup(group);
  }, [group]);

  // Fetch available tickets when dialog opens
  useEffect(() => {
    if (open && currentGroup) {
      fetchAvailableTickets();
      fetchGroupData();
    } else {
      // Reset state when dialog closes
      setSelectedTicketsToAdd([]);
      setSelectedTicketsToRemove([]);
      setSearchQuery("");
      setAvailableTickets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentGroup]);

  const fetchGroupData = useCallback(async () => {
    if (!currentGroup) return;

    try {
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        cache: "no-store",
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const updatedGroup = await response.json();
          setCurrentGroup(updatedGroup);
        } else {
          console.error("Server returned non-JSON response when fetching group");
        }
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    }
  }, [currentGroup]);

  const fetchAvailableTickets = useCallback(async () => {
    if (!currentGroup) return;

    try {
      setLoadingTickets(true);
      const response = await fetch("/api/tickets/admin?limit=1000", {
        cache: "no-store",
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          const tickets = data.tickets || [];
        
          // Filter out tickets that are already in this group
          const groupTicketIds = new Set(currentGroup.tickets.map(t => t.id));
          const available = tickets
            .filter((t: Ticket) => !groupTicketIds.has(t.id))
            .map((t: Ticket) => ({
              ...t,
              category_name: t.category_name || (t as { category?: { name?: string } }).category?.name || null,
            }));
        
          setAvailableTickets(available);
        } else {
          console.error("Server returned non-JSON response when fetching available tickets");
        }
      } else {
        toast.error("Failed to load available tickets");
      }
    } catch (error) {
      console.error("Error fetching available tickets:", error);
      toast.error("An error occurred while loading tickets");
    } finally {
      setLoadingTickets(false);
    }
  }, [group]);

  const handleAddTickets = useCallback(async () => {
    if (!currentGroup || selectedTicketsToAdd.length === 0) {
      toast.error("Please select tickets to add");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addTicketIds: selectedTicketsToAdd,
        }),
      });

      if (response.ok) {
        toast.success(`Added ${selectedTicketsToAdd.length} ticket(s) to group`);
        setSelectedTicketsToAdd([]);
        // Refresh group data and available tickets to reflect changes
        await Promise.all([fetchGroupData(), fetchAvailableTickets()]);
        onSuccess?.();
        // Don't close dialog automatically - let user continue managing
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to add tickets to group");
        } else {
          toast.error(`Failed to add tickets to group (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error adding tickets to group:", error);
      toast.error("Failed to add tickets to group");
    } finally {
      setLoading(false);
    }
  }, [currentGroup, selectedTicketsToAdd, onSuccess, fetchAvailableTickets]);

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
        // Refresh group data and available tickets to reflect changes
        await Promise.all([fetchGroupData(), fetchAvailableTickets()]);
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
  }, [currentGroup, selectedTicketsToRemove, onSuccess, fetchAvailableTickets]);

  const toggleTicketToAdd = (ticketId: number) => {
    setSelectedTicketsToAdd(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const toggleTicketToRemove = (ticketId: number) => {
    setSelectedTicketsToRemove(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const filteredAvailableTickets = availableTickets.filter(ticket => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.id.toString().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.location?.toLowerCase().includes(query) ||
      ticket.category_name?.toLowerCase().includes(query)
    );
  });

  const filteredGroupTickets = currentGroup?.tickets.filter(ticket => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.id.toString().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.location?.toLowerCase().includes(query)
    );
  }) || [];

  // Helper function to compute TAT info (exactly like TicketCard)
  const computeTatInfo = (date?: Date | null) => {
    if (!date) return { overdue: false, label: null };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diff = (tatDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    const diffDays = Math.round(diff);

    if (diffDays < 0) return { overdue: true, label: `${Math.abs(diffDays)} days overdue` };
    if (diffDays === 0) return { overdue: false, label: "Due today" };
    if (diffDays === 1) return { overdue: false, label: "Due tomorrow" };
    if (diffDays <= 7) return { overdue: false, label: `Due in ${diffDays} days` };

    return {
      overdue: false,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  };

  // Helper to get TAT date from ticket (exactly like TicketCard)
  const getTatDate = (ticket: Ticket): Date | null => {
    // Parse metadata first (same order as TicketCard)
    const metadata = (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata))
      ? ticket.metadata as { tatDate?: string }
      : null;
    
    // Same priority order as TicketCard: due_at || resolution_due_at || metadata.tatDate
    if (ticket.due_at) {
      return ticket.due_at instanceof Date ? ticket.due_at : new Date(ticket.due_at);
    }
    if (ticket.resolution_due_at) {
      return ticket.resolution_due_at instanceof Date ? ticket.resolution_due_at : new Date(ticket.resolution_due_at);
    }
    if (metadata?.tatDate) {
      return new Date(metadata.tatDate);
    }
    return null;
  };

  if (!currentGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Tickets: {currentGroup.name}</DialogTitle>
          <DialogDescription>
            Add or remove tickets from this group. Currently {currentGroup.ticketCount} ticket(s) in group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tickets by ID, description, location, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Tickets in Group */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Tickets in Group ({currentGroup.ticketCount})
                </h4>
                {selectedTicketsToRemove.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveTickets}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    Remove ({selectedTicketsToRemove.length})
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[400px] border rounded-md p-2">
                {filteredGroupTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Package className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No tickets found" : "No tickets in group"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGroupTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-2 p-2 rounded-md border hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedTicketsToRemove.includes(ticket.id)}
                          onCheckedChange={() => toggleTicketToRemove(ticket.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-mono font-semibold">#{ticket.id}</span>
                            {ticket.status && (
                              <Badge variant="outline" className="text-xs">
                                {ticket.status}
                              </Badge>
                            )}
                            {(() => {
                              const tatDate = getTatDate(ticket);
                              const tatInfo = computeTatInfo(tatDate);
                              if (!tatDate || !tatInfo.label) return null;
                              return (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 sm:gap-1.5 font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs flex-shrink-0",
                                    tatInfo.overdue
                                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  )}
                                >
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  <span className="whitespace-nowrap">{tatInfo.label}</span>
                                </div>
                              );
                            })()}
                          </div>
                          {ticket.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ticket.description}
                            </p>
                          )}
                          {ticket.location && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📍 {ticket.location}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Available Tickets to Add */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Available Tickets ({availableTickets.length})
                </h4>
                {selectedTicketsToAdd.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddTickets}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add ({selectedTicketsToAdd.length})
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[400px] border rounded-md p-2">
                {loadingTickets ? (
                  <div className="flex flex-col items-center justify-center h-full py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Loading tickets...</p>
                  </div>
                ) : filteredAvailableTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Package className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No tickets found" : "No available tickets"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-2 p-2 rounded-md border hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedTicketsToAdd.includes(ticket.id)}
                          onCheckedChange={() => toggleTicketToAdd(ticket.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-mono font-semibold">#{ticket.id}</span>
                            {ticket.status && (
                              <Badge variant="outline" className="text-xs">
                                {ticket.status}
                              </Badge>
                            )}
                            {(() => {
                              const tatDate = getTatDate(ticket);
                              const tatInfo = computeTatInfo(tatDate);
                              if (!tatDate || !tatInfo.label) return null;
                              return (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 sm:gap-1.5 font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs flex-shrink-0",
                                    tatInfo.overdue
                                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  )}
                                >
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  <span className="whitespace-nowrap">{tatInfo.label}</span>
                                </div>
                              );
                            })()}
                          </div>
                          {ticket.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ticket.description}
                            </p>
                          )}
                          {ticket.location && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📍 {ticket.location}
                            </p>
                          )}
                          {ticket.category_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📁 {ticket.category_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
