"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, X, MessageSquare, Loader2, Archive, RotateCcw, Search, Settings, Clock } from "lucide-react";
import { ManageGroupTicketsDialog } from "./ManageGroupTicketsDialog";
import { cn } from "@/lib/utils";

interface Ticket {
  id: number;
  status: string | null;
  description: string | null;
  location?: string | null;
  created_at: Date | string;
  category_name?: string | null;
  resolution_due_at?: Date | string | null;
  metadata?: {
    tatDate?: string;
    tat?: string;
  } | null;
  // Legacy fields kept for backward compatibility with API responses
  user_number?: string | null;
  category?: string | null;
  subcategory?: string | null;
}

interface TicketGroup {
  id: number;
  name: string;
  description: string | null;
  created_at: Date | string;
  is_archived: boolean;
  tickets: Ticket[];
  ticketCount: number;
}

interface TicketGroupingProps {
  selectedTicketIds: number[];
  onGroupCreated?: () => void;
}

export function TicketGrouping({ selectedTicketIds, onGroupCreated }: TicketGroupingProps) {
  const [groups, setGroups] = useState<TicketGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [bulkAction, setBulkAction] = useState<"comment" | "close">("comment");
  const [bulkComment, setBulkComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isManageTicketsDialogOpen, setIsManageTicketsDialogOpen] = useState(false);
  const [selectedGroupForManagement, setSelectedGroupForManagement] = useState<TicketGroup | null>(null);
  const [stats, setStats] = useState<{
    totalGroups: number;
    activeGroups: number;
    archivedGroups: number;
    totalTicketsInGroups: number;
  } | null>(null);

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tickets/groups", { cache: "no-store" });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setGroups(data.groups || []);
          setStats(data.stats || null);
        } else {
          toast.error("Server returned invalid response format");
        }
      } else {
        toast.error("Failed to load groups. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("An error occurred while loading groups.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim() || selectedTicketIds.length === 0) {
      toast.error("Please provide a group name and select at least one ticket");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/tickets/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          ticketIds: selectedTicketIds,
        }),
      });

      if (response.ok) {
        toast.success("Ticket group created successfully");
        setGroupName("");
        setGroupDescription("");
        setIsCreateDialogOpen(false);
        fetchGroups();
        onGroupCreated?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to create group");
        } else {
          toast.error(`Failed to create group (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  }, [selectedTicketIds, groupName, groupDescription, onGroupCreated, fetchGroups]);

  const handleBulkAction = useCallback(async () => {
    if (!selectedGroupId) {
      toast.error("Please select a group");
      return;
    }

    if (bulkAction === "comment" && !bulkComment.trim()) {
      toast.error("Please provide a comment");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/groups/${selectedGroupId}/bulk-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          comment: bulkComment.trim() || null,
          status: bulkAction === "close" ? "resolved" : undefined,
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          toast.success(
            `Bulk action completed: ${data.summary.successful} successful, ${data.summary.failed} failed`
          );
        } else {
          toast.error("Server returned invalid response format");
        }
        setBulkComment("");
        setIsBulkActionDialogOpen(false);
        setSelectedGroupId(null);
        fetchGroups();
        onGroupCreated?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to perform bulk action");
        } else {
          toast.error(`Failed to perform bulk action (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error performing bulk action:", error);
      toast.error("Failed to perform bulk action");
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, bulkAction, bulkComment, onGroupCreated, fetchGroups]);

  const handleDeleteGroup = useCallback(async (groupId: number) => {
    if (!confirm("Are you sure you want to delete this group? Tickets will be ungrouped.")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/groups/${groupId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Group deleted successfully");
        fetchGroups();
        onGroupCreated?.();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          toast.error(error.error || "Failed to delete group");
        } else {
          toast.error(`Failed to delete group (${response.status} ${response.statusText})`);
        }
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    } finally {
      setLoading(false);
    }
  }, [onGroupCreated, fetchGroups]);

  // Filter groups based on search query (memoized for performance)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(group => 
      group.name.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query) ||
      group.tickets.some(t => t.id.toString().includes(query))
    );
  }, [groups, searchQuery]);

  // Memoize displayed groups (filtered by archived status)
  const displayedGroups = useMemo(() => 
    filteredGroups.filter(group => showArchived || !group.is_archived),
    [filteredGroups, showArchived]
  );

  // Memoize stats calculations
  const activeGroupsCount = useMemo(() => 
    filteredGroups.filter(g => !g.is_archived).length,
    [filteredGroups]
  );
  
  const archivedGroupsCount = useMemo(() => 
    filteredGroups.filter(g => g.is_archived).length,
    [filteredGroups]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Ticket Groups</h3>
          {stats && (
            <Badge variant="secondary" className="text-xs">
              {stats.activeGroups} active
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGroups}
            disabled={loading}
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={selectedTicketIds.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Create Group ({selectedTicketIds.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Ticket Group</DialogTitle>
                <DialogDescription>
                  Group selected tickets together for bulk operations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Group Name *</Label>
                  <Input
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Wi-Fi Issues - Velankani"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupDescription">Description (Optional)</Label>
                  <Textarea
                    id="groupDescription"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Brief description of the grouped tickets..."
                    rows={3}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedTicketIds.length} ticket{selectedTicketIds.length !== 1 ? "s" : ""} will be added to this group
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroup} disabled={loading || !groupName.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Group"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={groups.length === 0}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Bulk Actions
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Action on Group</DialogTitle>
                <DialogDescription>
                  Perform actions on all tickets in a group
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupSelect">Select Group *</Label>
                  <Select
                    value={selectedGroupId?.toString() || ""}
                    onValueChange={(value) => setSelectedGroupId(parseInt(value, 10))}
                  >
                    <SelectTrigger id="groupSelect">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups
                        .filter(group => !group.is_archived)
                        .map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            {group.name} ({group.ticketCount} tickets)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulkAction">Action *</Label>
                  <Select
                    value={bulkAction}
                    onValueChange={(value) => setBulkAction(value as "comment" | "close")}
                  >
                    <SelectTrigger id="bulkAction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comment">Add Comment</SelectItem>
                      <SelectItem value="close">Close All Tickets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {bulkAction === "comment" && (
                  <div className="space-y-2">
                    <Label htmlFor="bulkComment">Comment *</Label>
                    <Textarea
                      id="bulkComment"
                      value={bulkComment}
                      onChange={(e) => setBulkComment(e.target.value)}
                      placeholder="Enter comment to add to all tickets..."
                      rows={4}
                      required
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkAction}
                  disabled={loading || !selectedGroupId || (bulkAction === "comment" && !bulkComment.trim())}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    bulkAction === "comment" ? "Add Comment" : "Close All"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      {groups.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search groups by name, description, or ticket ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {loading && groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading groups...</p>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No ticket groups yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select tickets and create a group to manage them together
            </p>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium mb-1">No groups found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try adjusting your search query" : "Create a group to get started"}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {activeGroupsCount} active group{activeGroupsCount !== 1 ? "s" : ""}
              {archivedGroupsCount > 0 && (
                <span className="ml-2">
                  • {archivedGroupsCount} archived
                </span>
              )}
              {searchQuery && (
                <span className="ml-2 text-primary">
                  • {filteredGroups.length} result{filteredGroups.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {filteredGroups.some(g => g.is_archived) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="w-4 h-4 mr-2" />
                {showArchived ? "Hide" : "Show"} Archived
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayedGroups.map((group) => (
              <Card 
                key={group.id} 
                className={`relative transition-all hover:shadow-md ${group.is_archived ? "opacity-60 border-dashed" : "hover:border-primary/50"}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        {group.is_archived && (
                          <Badge variant="secondary" className="text-xs">
                            <Archive className="w-3 h-3 mr-1" />
                            Archived
                          </Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                      )}
                    </div>
                    {!group.is_archived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge variant="secondary">
                        {group.ticketCount} ticket{group.ticketCount !== 1 ? "s" : ""}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {group.created_at ? new Date(group.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    {/* Group TAT Display */}
                    {(() => {
                      // Calculate group TAT from tickets
                      const groupTATInfo = (() => {
                        if (!group.tickets || group.tickets.length === 0) return null;
                        
                        // Get the most common TAT date or the earliest due date
                        const tatDates: Date[] = [];
                        const tatTexts: string[] = [];
                        
                        group.tickets.forEach(ticket => {
                          // Try to get TAT from resolution_due_at first
                          if (ticket.resolution_due_at) {
                            const date = ticket.resolution_due_at instanceof Date 
                              ? ticket.resolution_due_at 
                              : new Date(ticket.resolution_due_at);
                            if (!isNaN(date.getTime())) {
                              tatDates.push(date);
                            }
                          }
                          
                          // Also check metadata
                          if (ticket.metadata && typeof ticket.metadata === 'object') {
                            const metadata = ticket.metadata as { tatDate?: string; tat?: string };
                            if (metadata.tatDate) {
                              const date = new Date(metadata.tatDate);
                              if (!isNaN(date.getTime())) {
                                tatDates.push(date);
                              }
                            }
                            if (metadata.tat) {
                              tatTexts.push(metadata.tat);
                            }
                          }
                        });
                        
                        if (tatDates.length === 0) return null;
                        
                        // Get the earliest TAT date (most urgent)
                        const earliestDate = new Date(Math.min(...tatDates.map(d => d.getTime())));
                        const now = new Date();
                        const diff = (earliestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                        const diffDays = Math.round(diff);
                        
                        let label = "";
                        let isOverdue = false;
                        
                        if (diffDays < 0) {
                          isOverdue = true;
                          label = `${Math.abs(diffDays)} days overdue`;
                        } else if (diffDays === 0) {
                          label = "Due today";
                        } else if (diffDays === 1) {
                          label = "Due tomorrow";
                        } else if (diffDays <= 7) {
                          label = `Due in ${diffDays} days`;
                        } else {
                          label = earliestDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        }
                        
                        // Get most common TAT text if available
                        const mostCommonTAT = tatTexts.length > 0 
                          ? tatTexts.sort((a, b) => 
                              tatTexts.filter(v => v === a).length - tatTexts.filter(v => v === b).length
                            ).pop() || null
                          : null;
                        
                        return { label, isOverdue, tatText: mostCommonTAT };
                      })();
                      
                      if (!groupTATInfo) return null;
                      
                      return (
                        <div className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border",
                          groupTATInfo.isOverdue
                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        )}>
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1">{groupTATInfo.label}</span>
                          {groupTATInfo.tatText && (
                            <span className="text-[10px] opacity-75 ml-1">
                              ({groupTATInfo.tatText})
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="space-y-1.5">
                      {group.tickets.slice(0, 3).map((ticket) => (
                        <div key={ticket.id} className="text-sm flex items-center justify-between p-1.5 rounded-md hover:bg-accent/50 transition-colors">
                          <span className="text-muted-foreground font-mono">#{ticket.id}</span>
                          {ticket.category_name && (
                            <Badge variant="outline" className="text-xs">
                              {ticket.category_name}
                            </Badge>
                          )}
                        </div>
                      ))}
                      {group.tickets.length > 3 && (
                        <p className="text-xs text-muted-foreground pl-1.5">
                          +{group.tickets.length - 3} more ticket{group.tickets.length - 3 !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    {!group.is_archived && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedGroupForManagement(group);
                            setIsManageTicketsDialogOpen(true);
                          }}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Tickets
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedGroupId(group.id);
                            setIsBulkActionDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Bulk Actions
                        </Button>
                      </div>
                    )}
                    {group.is_archived && (
                      <div className="text-xs text-center text-muted-foreground py-2">
                        All tickets resolved
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Manage Group Tickets Dialog */}
      <ManageGroupTicketsDialog
        group={selectedGroupForManagement}
        open={isManageTicketsDialogOpen}
        onOpenChange={(open) => {
          setIsManageTicketsDialogOpen(open);
          if (!open) {
            setSelectedGroupForManagement(null);
          }
        }}
        onSuccess={() => {
          fetchGroups();
          onGroupCreated?.();
        }}
      />
    </div>
  );
}
