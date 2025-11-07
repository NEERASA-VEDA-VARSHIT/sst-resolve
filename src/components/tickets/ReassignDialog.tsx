"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAdminList } from "@/hook/useAdminList";

interface ReassignDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	ticketId: number;
	currentAssignedTo?: string;
	onReassigned?: () => void;
}

export function ReassignDialog({ open, onOpenChange, ticketId, currentAssignedTo, onReassigned }: ReassignDialogProps) {
	const { admins, loading: adminsLoading } = useAdminList();
	const [loading, setLoading] = useState(false);
	const [selectedAdmin, setSelectedAdmin] = useState<string>("");

	const handleReassign = async () => {
		if (!selectedAdmin) {
			toast.error("Please select an admin");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`/api/tickets/${ticketId}/reassign`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ assignedTo: selectedAdmin }),
			});

			if (response.ok) {
				toast.success("Ticket reassigned successfully");
				onOpenChange(false);
				setSelectedAdmin("");
				if (onReassigned) {
					onReassigned();
				}
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to reassign ticket" }));
				toast.error(error.error || "Failed to reassign ticket");
			}
		} catch (error) {
			console.error("Error reassigning ticket:", error);
			toast.error("Failed to reassign ticket. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Reassign Ticket</DialogTitle>
					<DialogDescription>
						Select an admin to reassign this ticket to.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div>
						<Label htmlFor="admin">Select Admin</Label>
						<Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
							<SelectTrigger id="admin">
								<SelectValue placeholder="Choose an admin..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="unassigned">Unassigned</SelectItem>
								{admins.map((admin) => (
									<SelectItem key={admin.id} value={admin.id}>
										{admin.name} ({admin.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleReassign} disabled={!selectedAdmin || loading}>
						{loading ? "Reassigning..." : "Reassign"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

