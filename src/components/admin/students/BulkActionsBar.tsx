"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Edit2 } from "lucide-react";

interface BulkActionsBarProps {
	selectedCount: number;
	onBulkEdit: () => void;
	onClearSelection: () => void;
}

export function BulkActionsBar({
	selectedCount,
	onBulkEdit,
	onClearSelection,
}: BulkActionsBarProps) {
	if (selectedCount === 0) return null;

	return (
		<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
			<Card className="shadow-lg border-2">
				<CardContent className="flex items-center gap-4 p-4">
					<div className="flex items-center gap-2">
						<Users className="w-5 h-5 text-primary" />
						<span className="font-semibold">
							{selectedCount} student{selectedCount !== 1 ? "s" : ""} selected
						</span>
					</div>
					<div className="flex gap-2">
						<Button variant="default" size="sm" onClick={onBulkEdit}>
							<Edit2 className="w-4 h-4 mr-2" />
							Bulk Edit
						</Button>
						<Button variant="outline" size="sm" onClick={onClearSelection}>
							Clear Selection
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
