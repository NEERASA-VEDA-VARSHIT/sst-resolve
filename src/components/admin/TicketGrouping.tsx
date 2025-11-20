"use client";

import { useState, useEffect } from "react";
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
import { Users, Plus, X, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

interface Ticket {
  id: number;
  status: string | null;
  description: string | null;
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [bulkAction, setBulkAction] = useState<"comment" | "close">("comment");
  const [bulkComment, setBulkComment] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tickets/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
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
        const error = await response.json();
        toast.error(error.error || "Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async () => {
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
        const data = await response.json();
        toast.success(
          `Bulk action completed: ${data.summary.successful} successful, ${data.summary.failed} failed`
        );
        setBulkComment("");
        setIsBulkActionDialogOpen(false);
        setSelectedGroupId(null);
        fetchGroups();
        onGroupCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to perform bulk action");
      }
    } catch (error) {
      console.error("Error performing bulk action:", error);
      toast.error("Failed to perform bulk action");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
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
        const error = await response.json();
        toast.error(error.error || "Failed to delete group");
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Ticket Groups
        </h3>
        <div className="flex gap-2">
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
                      {groups.map((group) => (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {group.ticketCount} ticket{group.ticketCount !== 1 ? "s" : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(group.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.tickets.slice(0, 3).map((ticket) => (
                      <div key={ticket.id} className="text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">#{ticket.id}</span>
                        <Badge variant="outline" className="text-xs">
                          {ticket.status}
                        </Badge>
                      </div>
                    ))}
                    {group.tickets.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{group.tickets.length - 3} more
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setIsBulkActionDialogOpen(true);
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Manage Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

