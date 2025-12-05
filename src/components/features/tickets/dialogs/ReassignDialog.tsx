"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAdmins } from "@/lib/api/admins";
import { api, endpoints } from "@/lib/api/client";
import { logger } from "@/lib/logger";

interface ReassignDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	ticketId: number;
	currentAssignedTo?: string | null;
	onReassigned?: () => void;
}

export function ReassignDialog({
	open,
	onOpenChange,
	ticketId,
	currentAssignedTo,
	onReassigned,
}: ReassignDialogProps) {
	const { admins, loading: adminsLoading } = useAdmins("list");
	const [loading, setLoading] = useState(false);
	const [selectedAdmin, setSelectedAdmin] = useState<string>("");

	// Show all admins for reassignment; domain/scope-based auto-assignment
	// is handled at ticket creation time. For manual reassignment, we want
	// super admins to be able to see the full roster.
	const filteredAdmins = useMemo(() => admins, [admins]);

	useEffect(() => {
		if (open) {
			setSelectedAdmin(currentAssignedTo ?? "");
		}
	}, [open, currentAssignedTo]);

	const handleReassign = async () => {
		if (!selectedAdmin) {
			toast.error("Please select an admin");
			return;
		}

		setLoading(true);
		try {
			await api.post(endpoints.ticketReassign(ticketId), {
				assignedTo: selectedAdmin,
			});

			toast.success("Ticket reassigned successfully");
			onOpenChange(false);
			setSelectedAdmin("");
			if (onReassigned) {
				onReassigned();
			}
		} catch (error) {
			logger.error("Error reassigning ticket", error, { component: "ReassignDialog", ticketId });
			// Error toast is handled by api client
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
						<Select
							value={selectedAdmin}
							onValueChange={setSelectedAdmin}
							disabled={adminsLoading}
						>
							<SelectTrigger id="admin">
								<SelectValue placeholder={adminsLoading ? "Loading admins..." : "Choose an admin..."} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="unassigned">Unassigned</SelectItem>
								{filteredAdmins.length === 0 ? (
									<SelectItem value="__no_admin" disabled>
										No eligible admins found for this ticket
									</SelectItem>
								) : (
									filteredAdmins.map((admin) => (
										<SelectItem key={admin.id} value={admin.id}>
											<span className="flex flex-col">
												<span className="font-medium">{admin.name}</span>
												<span className="text-xs text-muted-foreground">
													{admin.email}
													{admin.domain && (
														<span>
															{` • ${admin.domain}${admin.scope ? ` – ${admin.scope}` : ""}`}
														</span>
													)}
												</span>
											</span>
										</SelectItem>
									))
								)}
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
