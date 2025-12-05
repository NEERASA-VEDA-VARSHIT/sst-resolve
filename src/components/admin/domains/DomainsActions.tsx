"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface DomainsActionsProps {
  onEdit: (e?: React.MouseEvent) => void;
  onDelete: (e?: React.MouseEvent) => void;
}

export function DomainsActions({ onEdit, onDelete }: DomainsActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
