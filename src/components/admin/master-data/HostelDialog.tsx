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
import type { Hostel } from "@/db/types-only";

interface HostelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingHostel: Hostel | null;
	formData: { name: string; is_active: boolean };
	onFormChange: (data: { name: string; is_active: boolean }) => void;
	onSubmit: () => Promise<void>;
	loading: boolean;
}

export function HostelDialog({
	open,
	onOpenChange,
	editingHostel,
	formData,
	onFormChange,
	onSubmit,
	loading,
}: HostelDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editingHostel ? "Edit Hostel" : "Add Hostel"}</DialogTitle>
					<DialogDescription>
						{editingHostel ? "Update hostel details" : "Create a new hostel"}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="hostel-name">Hostel Name</Label>
						<Input
							id="hostel-name"
							value={formData.name}
							onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
							placeholder="e.g., Hostel A"
						/>
					</div>
					<div className="flex items-center space-x-2">
						<input
							id="hostel-active"
							type="checkbox"
							checked={formData.is_active}
							onChange={(e) => onFormChange({ ...formData, is_active: e.target.checked })}
							className="h-4 w-4"
						/>
						<Label htmlFor="hostel-active">Active</Label>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={loading}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{editingHostel ? "Update" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
