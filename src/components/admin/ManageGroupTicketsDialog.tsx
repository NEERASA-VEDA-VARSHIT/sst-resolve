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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, Package, Clock, MapPin, Calendar, ExternalLink, FileText, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

type ApiTicketResponse = Ticket & {
  category?: { name?: string | null } | null;
};

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
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([]);
  const [selectedTicketsToAdd, setSelectedTicketsToAdd] = useState<number[]>([]);
  const [selectedTicketsToRemove, setSelectedTicketsToRemove] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<TicketGroup | null>(group);
  const currentGroupRef = useRef<TicketGroup | null>(group);
  const [groupTAT, setGroupTAT] = useState("");
  const [loadingTAT, setLoadingTAT] = useState(false);
  const [committees, setCommittees] = useState<Array<{ id: number; name: string; description: string | null }>>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>("");
  const [loadingCommittees, setLoadingCommittees] = useState(false);
  const [loadingCommitteeUpdate, setLoadingCommitteeUpdate] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentGroupRef.current = currentGroup;
  }, [currentGroup]);

  // Update currentGroup when group prop changes
  useEffect(() => {
    setCurrentGroup(group);
    if (group?.committee_id) {
      setSelectedCommitteeId(String(group.committee_id));
    } else {
      setSelectedCommitteeId("");
    }
  }, [group]);

  // Fetch committees when dialog opens
  useEffect(() => {
    if (open) {
      fetchCommittees();
    }
  }, [open]);

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

  // Fetch available tickets when dialog opens
  useEffect(() => {
    if (open && currentGroup?.id) {
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
  }, [open, currentGroup?.id]);

  const fetchGroupData = useCallback(async () => {
    if (!currentGroup?.id) return;

    try {
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        cache: "no-store",
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

  const fetchAvailableTickets = useCallback(async () => {
    if (!currentGroup?.id) return;

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
          // Use ref to get latest currentGroup without causing re-renders
          const latestGroup = currentGroupRef.current;
          if (!latestGroup) {
            setAvailableTickets([]);
            return;
          }
          
          const groupTicketIds = new Set((latestGroup.tickets || []).map(t => t.id));
          const available = tickets
            .filter((t: Ticket) => !groupTicketIds.has(t.id))
            .map((t: ApiTicketResponse) => ({
              id: t.id,
              status: t.status,
              description: t.description,
              location: t.location,
              created_at: t.created_at,
              due_at: t.due_at,
              resolution_due_at: t.due_at || t.resolution_due_at,
              metadata: t.metadata,
              category_name: t.category_name || (t.category?.name) || null,
            }));
          
          setAvailableTickets(available);
        } else {
          console.error("Server returned non-JSON response when fetching available tickets");
          toast.error("Failed to load available tickets");
        }
      } else {
        const errorText = await response.text();
        console.error("Failed to fetch tickets:", response.status, errorText);
        toast.error("Failed to load available tickets");
      }
    } catch (error) {
      console.error("Error fetching available tickets:", error);
      toast.error("An error occurred while loading tickets");
    } finally {
      setLoadingTickets(false);
    }
  }, [currentGroup?.id]);

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
  }, [currentGroup?.id, selectedTicketsToAdd, onSuccess, fetchAvailableTickets, fetchGroupData]);

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
  }, [currentGroup?.id, selectedTicketsToRemove, onSuccess, fetchAvailableTickets, fetchGroupData]);

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

  const handleSetGroupTAT = useCallback(async () => {
    if (!currentGroup?.id || !groupTAT.trim()) {
      toast.error("Please enter a TAT value (e.g., '2 days', '1 week')");
      return;
    }

    try {
      setLoadingTAT(true);
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupTAT: groupTAT.trim(),
        }),
      });

      if (response.ok) {
        toast.success(`TAT set for all tickets in group`);
        setGroupTAT("");
        // Refresh group data to reflect changes
        await fetchGroupData();
        onSuccess?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to set group TAT");
        } else {
          toast.error(`Failed to set group TAT (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error setting group TAT:", error);
      toast.error("Failed to set group TAT");
    } finally {
      setLoadingTAT(false);
    }
  }, [currentGroup?.id, groupTAT, fetchGroupData, onSuccess]);

  const handleSetCommittee = useCallback(async () => {
    if (!currentGroup?.id) {
      toast.error("Group not found");
      return;
    }

    try {
      setLoadingCommitteeUpdate(true);
      const committeeId = selectedCommitteeId === "" || selectedCommitteeId === "none" ? null : parseInt(selectedCommitteeId, 10);
      
      const response = await fetch(`/api/tickets/groups/${currentGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committee_id: committeeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(committeeId ? `Group assigned to committee` : `Committee assignment removed`);
        // Update current group state
        setCurrentGroup(prev => prev ? { ...prev, committee_id: committeeId, committee: data.committee } : null);
        // Refresh group data to reflect changes
        await fetchGroupData();
        onSuccess?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to assign committee");
        } else {
          toast.error(`Failed to assign committee (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error setting committee:", error);
      toast.error("Failed to assign committee");
    } finally {
      setLoadingCommitteeUpdate(false);
    }
  }, [currentGroup?.id, selectedCommitteeId, fetchGroupData, onSuccess]);

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
      ? ticket.metadata as { tatDate?: string; tat?: string }
      : null;
    
    // Same priority order as TicketCard: due_at || resolution_due_at || metadata.tatDate
    if (ticket.due_at) {
      const date = ticket.due_at instanceof Date ? ticket.due_at : new Date(ticket.due_at);
      if (!isNaN(date.getTime())) return date;
    }
    if (ticket.resolution_due_at) {
      const date = ticket.resolution_due_at instanceof Date ? ticket.resolution_due_at : new Date(ticket.resolution_due_at);
      if (!isNaN(date.getTime())) return date;
    }
    if (metadata?.tatDate) {
      const date = new Date(metadata.tatDate);
      if (!isNaN(date.getTime())) return date;
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
            <span className="block mt-1 text-xs text-muted-foreground">
              💡 Tip: Click the external link icon to view full ticket details. Use Bulk Actions from the groups page to comment or close all tickets in this group.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Committee Assignment */}
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Assign Committee (committee will have access to all tickets in this group)
              </label>
              <Select
                value={selectedCommitteeId || "none"}
                onValueChange={setSelectedCommitteeId}
                disabled={loadingCommittees}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a committee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Committee</SelectItem>
                  {committees.map((committee) => (
                    <SelectItem key={committee.id} value={String(committee.id)}>
                      {committee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSetCommittee}
              disabled={loadingCommitteeUpdate || loadingCommittees}
              size="sm"
              className="h-9"
            >
              {loadingCommitteeUpdate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </div>
          {currentGroup?.committee && (
            <div className="px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Assigned to: {currentGroup.committee.name}
                </span>
              </div>
              {currentGroup.committee.description && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                  {currentGroup.committee.description}
                </p>
              )}
            </div>
          )}

          {/* Group TAT Management */}
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Set Group TAT (applies to all tickets in group)
              </label>
              <Input
                placeholder="e.g., '2 days', '1 week', '3 hours'"
                value={groupTAT}
                onChange={(e) => setGroupTAT(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSetGroupTAT();
                  }
                }}
                className="h-9"
              />
            </div>
            <Button
              onClick={handleSetGroupTAT}
              disabled={loadingTAT || !groupTAT.trim()}
              size="sm"
              className="h-9"
            >
              {loadingTAT ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Set TAT
                </>
              )}
            </Button>
          </div>

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
                  Tickets in Group ({filteredGroupTickets.length}{currentGroup.ticketCount !== filteredGroupTickets.length ? ` of ${currentGroup.ticketCount}` : ''})
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
                    <Package className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {searchQuery ? "No tickets found" : "No tickets in group"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGroupTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-2 p-3 rounded-lg border hover:bg-accent/50 hover:border-destructive/50 transition-all cursor-pointer"
                        onClick={() => toggleTicketToRemove(ticket.id)}
                      >
                        <Checkbox
                          checked={selectedTicketsToRemove.includes(ticket.id)}
                          onCheckedChange={() => toggleTicketToRemove(ticket.id)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              <span className="text-sm font-mono font-semibold text-primary">#{ticket.id}</span>
                              {ticket.status && (
                                <Badge variant="outline" className="text-xs">
                                  {ticket.status}
                                </Badge>
                              )}
                              {ticket.category_name && (
                                <Badge variant="secondary" className="text-xs">
                                  📁 {ticket.category_name}
                                </Badge>
                              )}
                              {(() => {
                                const tatDate = getTatDate(ticket);
                                const tatInfo = computeTatInfo(tatDate);
                                if (!tatDate || !tatInfo.label) return null;
                                return (
                                  <div
                                    className={cn(
                                      "flex items-center gap-1.5 font-semibold px-2 py-1 rounded-md text-xs flex-shrink-0",
                                      tatInfo.overdue
                                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                    )}
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="whitespace-nowrap">{tatInfo.label}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <a
                              href={`/admin/dashboard/ticket/${ticket.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          {ticket.description && (
                            <div className="mb-2">
                              <div className="flex items-start gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                  {ticket.description}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1.5">
                            {ticket.location && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                                <MapPin className="w-3 h-3" />
                                <span className="font-medium">{ticket.location}</span>
                              </div>
                            )}
                            {ticket.created_at && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                                </span>
                              </div>
                            )}
                          </div>
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
                  Available Tickets ({filteredAvailableTickets.length}{availableTickets.length !== filteredAvailableTickets.length ? ` of ${availableTickets.length}` : ''})
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
                    <Package className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {searchQuery ? "No tickets found" : "No available tickets"}
                    </p>
                    {!searchQuery && availableTickets.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        All tickets are already in this group or you don&rsquo;t have access
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-2 p-3 rounded-lg border hover:bg-accent/50 hover:border-primary/50 transition-all cursor-pointer group"
                        onClick={() => toggleTicketToAdd(ticket.id)}
                      >
                        <Checkbox
                          checked={selectedTicketsToAdd.includes(ticket.id)}
                          onCheckedChange={() => toggleTicketToAdd(ticket.id)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              <span className="text-sm font-mono font-semibold text-primary">#{ticket.id}</span>
                              {ticket.status && (
                                <Badge variant="outline" className="text-xs">
                                  {ticket.status}
                                </Badge>
                              )}
                              {ticket.category_name && (
                                <Badge variant="secondary" className="text-xs">
                                  📁 {ticket.category_name}
                                </Badge>
                              )}
                              {(() => {
                                const tatDate = getTatDate(ticket);
                                const tatInfo = computeTatInfo(tatDate);
                                if (!tatDate || !tatInfo.label) return null;
                                return (
                                  <div
                                    className={cn(
                                      "flex items-center gap-1.5 font-semibold px-2 py-1 rounded-md text-xs flex-shrink-0",
                                      tatInfo.overdue
                                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                    )}
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="whitespace-nowrap">{tatInfo.label}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <a
                              href={`/admin/dashboard/ticket/${ticket.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          {ticket.description && (
                            <div className="mb-2">
                              <div className="flex items-start gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                  {ticket.description}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1.5">
                            {ticket.location && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                                <MapPin className="w-3 h-3" />
                                <span className="font-medium">{ticket.location}</span>
                              </div>
                            )}
                            {ticket.created_at && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                                </span>
                              </div>
                            )}
                          </div>
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
