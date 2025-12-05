"use client";

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
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  onGroupNameChange: (value: string) => void;
  groupDescription: string;
  onGroupDescriptionChange: (value: string) => void;
  selectedTicketCount: number;
  loading: boolean;
  onSubmit: () => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  groupName,
  onGroupNameChange,
  groupDescription,
  onGroupDescriptionChange,
  selectedTicketCount,
  loading,
  onSubmit,
}: GroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onGroupNameChange(e.target.value)}
              placeholder="e.g., Wi-Fi Issues - Velankani"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="groupDescription">Description (Optional)</Label>
            <Textarea
              id="groupDescription"
              value={groupDescription}
              onChange={(e) => onGroupDescriptionChange(e.target.value)}
              placeholder="Brief description of the grouped tickets..."
              rows={3}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedTicketCount} ticket{selectedTicketCount !== 1 ? "s" : ""} will be added to this group
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || !groupName.trim()}>
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
  );
}
