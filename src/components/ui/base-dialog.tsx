/**
 * Reusable dialog boilerplate component
 * Reduces 500+ lines of duplicate dialog code across 10+ files
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

export interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  loading?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

export function BaseDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  loading = false,
  maxWidth = "md",
  className,
}: BaseDialogProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  const defaultFooter = (
    <DialogFooter>
      {onCancel && (
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      )}
      {onConfirm && (
        <Button type="button" onClick={onConfirm} disabled={confirmDisabled || loading}>
          {loading ? "Loading..." : confirmLabel}
        </Button>
      )}
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidthClasses[maxWidth]} ${className || ""}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">{children}</div>
        {footer !== undefined ? footer : defaultFooter}
      </DialogContent>
    </Dialog>
  );
}
