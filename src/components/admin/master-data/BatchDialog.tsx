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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { Batch } from "@/db/types-only";

interface BatchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingBatch: Batch | null;
	formData: { batch_year: string; is_active: boolean };
	onFormChange: (data: { batch_year: string; is_active: boolean }) => void;
	onSubmit: () => Promise<void>;
	loading: boolean;
}

export function BatchDialog({
	open,
	onOpenChange,
	editingBatch,
	formData,
	onFormChange,
	onSubmit,
	loading,
}: BatchDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editingBatch ? "Edit Batch" : "Add Batch"}</DialogTitle>
					<DialogDescription>
						{editingBatch ? "Update batch year" : "Create a new batch year"}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="batch-year">Batch Year</Label>
						<Input
							id="batch-year"
							type="number"
							value={formData.batch_year}
							onChange={(e) => onFormChange({ ...formData, batch_year: e.target.value })}
							placeholder="e.g., 2028"
							min="2000"
							max="2100"
						/>
					</div>
					<div className="flex items-center space-x-2">
						<input
							id="batch-active"
							type="checkbox"
							checked={formData.is_active}
							onChange={(e) => onFormChange({ ...formData, is_active: e.target.checked })}
							className="h-4 w-4"
						/>
						<Label htmlFor="batch-active">Active</Label>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={loading}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{editingBatch ? "Update" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
