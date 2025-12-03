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
import { toast } from "sonner";
import { Loader2, X, Search, Package, Clock, MapPin, Calendar, ExternalLink, FileText, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Status styles matching TicketCard
const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  REOPENED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  AWAITING_STUDENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ESCALATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

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
  const [searchQuery, setSearchQuery] = useState("");
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
      setSearchQuery("");
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
  }, [currentGroup, groupTAT, fetchGroupData, onSuccess]);

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
  }, [currentGroup, selectedCommitteeId, fetchGroupData, onSuccess]);

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
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl">Manage Tickets: {currentGroup.name}</DialogTitle>
          <DialogDescription className="text-sm mt-2">
            Remove tickets from this group and manage its committee assignment and TAT. Currently <span className="font-semibold">{currentGroup.ticketCount}</span> ticket{currentGroup.ticketCount !== 1 ? "s" : ""} in group.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-4 py-4">
            {/* Group Settings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group Committee Assignment */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Committee Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    value={selectedCommitteeId || "none"}
                    onValueChange={setSelectedCommitteeId}
                    disabled={loadingCommittees}
                  >
                    <SelectTrigger className="h-10">
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
                  <Button
                    onClick={handleSetCommittee}
                    disabled={loadingCommitteeUpdate || loadingCommittees}
                    className="w-full"
                    size="sm"
                  >
                    {loadingCommitteeUpdate ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Assign Committee
                      </>
                    )}
                  </Button>
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
                </CardContent>
              </Card>

              {/* Group TAT Management */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Group TAT
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    className="h-10"
                  />
                  <Button
                    onClick={handleSetGroupTAT}
                    disabled={loadingTAT || !groupTAT.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {loadingTAT ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        <Clock className="w-4 h-4 mr-2" />
                        Set TAT for All Tickets
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will apply the TAT to all tickets currently in the group.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search tickets by ID, description, location, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

          {/* Current Tickets in Group */}
          <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Tickets in Group
                    <Badge variant="secondary" className="ml-2">
                      {filteredGroupTickets.length}{currentGroup.ticketCount !== filteredGroupTickets.length ? ` of ${currentGroup.ticketCount}` : ''}
                    </Badge>
                  </CardTitle>
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
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px] -mx-4 px-4">
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
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer mb-2",
                          selectedTicketsToRemove.includes(ticket.id)
                            ? "bg-destructive/5 border-destructive/50 shadow-sm"
                            : "bg-card hover:bg-accent/50 hover:border-destructive/30"
                        )}
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
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs font-semibold border",
                                    STATUS_STYLES[ticket.status.toUpperCase()] || "bg-muted text-foreground"
                                  )}
                                >
                                  {ticket.status.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

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
