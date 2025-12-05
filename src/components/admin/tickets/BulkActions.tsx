"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface TicketGroup {
  id: number;
  name: string;
  ticketCount: number;
  is_archived: boolean;
}

interface BulkActionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TicketGroup[];
  selectedGroupId: number | null;
  onSelectedGroupIdChange: (id: number | null) => void;
  bulkAction: "comment" | "close";
  onBulkActionChange: (action: "comment" | "close") => void;
  bulkComment: string;
  onBulkCommentChange: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
}

export function BulkActions({
  open,
  onOpenChange,
  groups,
  selectedGroupId,
  onSelectedGroupIdChange,
  bulkAction,
  onBulkActionChange,
  bulkComment,
  onBulkCommentChange,
  loading,
  onSubmit,
}: BulkActionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onValueChange={(value) => onSelectedGroupIdChange(parseInt(value, 10))}
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
              onValueChange={(value) => onBulkActionChange(value as "comment" | "close")}
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
                onChange={(e) => onBulkCommentChange(e.target.value)}
                placeholder="Enter comment to add to all tickets..."
                rows={4}
                required
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
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
  );
}
