"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface StaffActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function StaffActions({
  onEdit,
  onDelete,
}: StaffActionsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
