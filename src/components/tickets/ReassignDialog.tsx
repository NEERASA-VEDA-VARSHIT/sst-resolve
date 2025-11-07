"use client";

import { useState, useMemo, useEffect } from "react";
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
	currentAssignedTo?: string | null;
	ticketCategory: string;
	ticketLocation?: string | null;
	onReassigned?: () => void;
}

export function ReassignDialog({
	open,
	onOpenChange,
	ticketId,
	currentAssignedTo,
	ticketCategory,
	ticketLocation,
	onReassigned,
}: ReassignDialogProps) {
	const { admins, loading: adminsLoading } = useAdminList();
	const [loading, setLoading] = useState(false);
	const [selectedAdmin, setSelectedAdmin] = useState<string>("");

	const normalizedCategory = ticketCategory?.toLowerCase() || "";
	const normalizedLocation = ticketLocation?.toLowerCase() || "";

	const filteredAdmins = useMemo(() => {
		return admins.filter((admin) => {
			const domain = admin.domain?.toLowerCase() || "";
			const scope = admin.scope?.toLowerCase() || "";

			if (!domain) return true; // fallback if assignment missing

			if (normalizedCategory === "hostel") {
				if (domain !== "hostel") return false;
				if (!scope) return true; // hostel-wide admin
				if (!normalizedLocation) return false;
				return scope === normalizedLocation;
			}

			if (normalizedCategory === "college") {
				return domain === "college";
			}

			return true;
		});
	}, [admins, normalizedCategory, normalizedLocation]);

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

