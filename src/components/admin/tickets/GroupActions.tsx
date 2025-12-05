"use client";

import { Button } from "@/components/ui/button";
import { Settings, MessageSquare, X } from "lucide-react";

interface GroupActionsProps {
  onManageTickets: () => void;
  onBulkActions: () => void;
  onDelete: () => void;
}

export function GroupActions({
  onManageTickets,
  onBulkActions,
  onDelete,
}: GroupActionsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={onManageTickets}
      >
        <Settings className="w-4 h-4 mr-2" />
        Manage Tickets
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={onBulkActions}
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Bulk Actions
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="h-8 w-8 p-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
