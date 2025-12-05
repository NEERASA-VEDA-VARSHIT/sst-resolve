"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

interface AddToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TicketGroup[];
  targetGroupId: number | null;
  onTargetGroupIdChange: (id: number | null) => void;
  selectedTicketCount: number;
  loading: boolean;
  onSubmit: () => void;
}

export function AddToGroupDialog({
  open,
  onOpenChange,
  groups,
  targetGroupId,
  onTargetGroupIdChange,
  selectedTicketCount,
  loading,
  onSubmit,
}: AddToGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tickets to Existing Group</DialogTitle>
          <DialogDescription>
            Add the currently selected tickets into an existing ticket group.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addGroupSelect">Select Group *</Label>
            <Select
              value={targetGroupId?.toString() || ""}
              onValueChange={(value) => onTargetGroupIdChange(parseInt(value, 10))}
            >
              <SelectTrigger id="addGroupSelect">
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
          <p className="text-sm text-muted-foreground">
            {selectedTicketCount} ticket{selectedTicketCount !== 1 ? "s" : ""} will be added to the selected group.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={loading || !targetGroupId || selectedTicketCount === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Group"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
