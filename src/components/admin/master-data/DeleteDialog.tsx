"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface DeleteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	itemName: string | null;
	onConfirm: () => void;
}

export function DeleteDialog({ open, onOpenChange, itemName, onConfirm }: DeleteDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-destructive" />
						Confirm Delete
					</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete <strong>{itemName}</strong>?
						This action cannot be undone and may affect student records.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
