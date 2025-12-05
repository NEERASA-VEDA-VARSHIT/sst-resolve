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
import type { ClassSection } from "@/db/types-only";

interface SectionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingSection: ClassSection | null;
	formData: { name: string };
	onFormChange: (data: { name: string }) => void;
	onSubmit: () => Promise<void>;
	loading: boolean;
}

export function SectionDialog({
	open,
	onOpenChange,
	editingSection,
	formData,
	onFormChange,
	onSubmit,
	loading,
}: SectionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
					<DialogDescription>
						{editingSection ? "Update section information" : "Create a new section"}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="section-name">Section Name</Label>
						<Input
							id="section-name"
							value={formData.name}
							onChange={(e) => onFormChange({ name: e.target.value })}
							placeholder="e.g., A"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={loading}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{editingSection ? "Update" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
