"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Clock, CheckCircle, FileText, UserCog, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReassignDialog } from "../dialogs/ReassignDialog";
import { normalizeStatusForComparison } from "@/lib/utils";
import { logger } from "@/lib/logger";

type ForwardTarget = {
	id: string;
	name: string;
	email: string | null;
};

export function AdminActions({
	ticketId,
	currentStatus,
	hasTAT,
	isSuperAdmin = false,
	currentAssignedTo,
	forwardTargets = [],
	tatExtensionCount: _tatExtensionCount = 0,
	onStatusChanged,
}: {
	ticketId: number;
	currentStatus: string;
	hasTAT?: boolean;
	isSuperAdmin?: boolean;
	currentAssignedTo?: string | null;
	forwardTargets?: ForwardTarget[];
	tatExtensionCount?: number;
	onStatusChanged?: (newStatus: string) => void;
}) {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);
	const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
	const [showCustomTat, setShowCustomTat] = useState(false);
	const [showCommentForm, setShowCommentForm] = useState(false);
	// Delete dialog state removed
	const [showReassignDialog, setShowReassignDialog] = useState(false);
	const [showForwardDialog, setShowForwardDialog] = useState(false);
	const [tat, setTat] = useState("");
	const [comment, setComment] = useState("");
	const [forwardReason, setForwardReason] = useState("");
	const [selectedForwardAdmin, setSelectedForwardAdmin] = useState<string>("auto");
	const [commentType, setCommentType] = useState<"comment" | "question" | "internal" | "super_admin">("comment");

	const DEFAULT_TAT = "48 hours";
	const handleMarkInProgress = async () => {
		// Optimistic update - update UI immediately
		setOptimisticStatus("in_progress");
		if (onStatusChanged) {
			onStatusChanged("in_progress");
		}
		setLoading("mark");
		
		try {
			const response = await fetch(`/api/tickets/${ticketId}/tat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tat: DEFAULT_TAT, markInProgress: true }),
			});

			if (response.ok) {
				toast.success("Ticket marked In Progress with 48h TAT");
				router.refresh();
				// Clear optimistic status after refresh
				setTimeout(() => setOptimisticStatus(null), 100);
			} else {
				// Rollback optimistic update
				setOptimisticStatus(null);
				if (onStatusChanged) {
					onStatusChanged(currentStatus);
				}
				const error = await response.json().catch(() => ({ error: "Failed to mark in progress" }));
				toast.error(error.error || "Failed to mark in progress");
			}
		} catch (error) {
			// Rollback optimistic update
			setOptimisticStatus(null);
			if (onStatusChanged) {
				onStatusChanged(currentStatus);
			}
			logger.error("Error marking in progress", error, { component: "AdminActions", action: "markInProgress" });
			toast.error("Failed to mark in progress. Please try again.");
		} finally {
			setLoading(null);
		}
	};


	// Normalize status for comparison (handles both uppercase enum and lowercase constants)
	const normalizedStatus = normalizeStatusForComparison(currentStatus);
	const hasForwardTargets = Array.isArray(forwardTargets) && forwardTargets.length > 0;

	useEffect(() => {
		if (!showForwardDialog) {
			setSelectedForwardAdmin("auto");
		}
	}, [showForwardDialog]);


	const handleSetTAT = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!tat.trim()) return;

		setLoading("tat");
		try {
			// Set TAT and update status to in_progress if not already
			const response = await fetch(`/api/tickets/${ticketId}/tat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tat, markInProgress: normalizedStatus !== "in_progress" }),
			});

			if (response.ok) {
				setTat("");
				setShowCustomTat(false);
				toast.success("TAT set successfully");
				router.refresh();
			} else {
				const errorData = await response.json().catch(() => ({ error: "Failed to set TAT" }));
				logger.error("TAT API error", errorData, { component: "AdminActions", action: "setTAT" });
				const errorMessage = errorData.error || errorData.details || "Failed to set TAT";
				toast.error(errorMessage);
			}
		} catch (error) {
			logger.error("Error setting TAT", error, { component: "AdminActions", action: "setTAT" });
			toast.error("Failed to set TAT. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	const handleAddComment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!comment.trim()) return;

		setLoading("comment");
		try {
			// Determine comment type for API
			let apiCommentType = "student_visible";
			let statusUpdate = null;

			if (commentType === "question") {
				apiCommentType = "student_visible";
				statusUpdate = "awaiting_student_response"; // Set status to await student response
			} else if (commentType === "internal") {
				apiCommentType = "internal_note";
			} else if (commentType === "super_admin") {
				apiCommentType = "super_admin_note";
			}

			const body: Record<string, unknown> = {
				comment,
				isAdmin: true,
				commentType: apiCommentType,
			};

			// If asking a question, also update status
			if (statusUpdate) {
				// First update status
				await fetch(`/api/tickets/${ticketId}/status`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: statusUpdate }),
				});
			}

			const response = await fetch(`/api/tickets/${ticketId}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (response.ok) {
				setComment("");
				setShowCommentForm(false);
				setCommentType("comment");
				const message = commentType === "question"
					? "Question sent to student successfully"
					: "Comment added successfully";
				toast.success(message);
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to add comment" }));
				toast.error(error.error || "Failed to add comment");
			}
		} catch (error) {
			logger.error("Error adding comment", error, { component: "AdminActions", action: "addComment" });
			toast.error("Failed to add comment. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	const handleMarkResolved = async () => {
		// Optimistic update - update UI immediately
		setOptimisticStatus("RESOLVED");
		if (onStatusChanged) {
			onStatusChanged("RESOLVED");
		}
		setLoading("resolved");
		
		try {
			const response = await fetch(`/api/tickets/${ticketId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "RESOLVED" }),
			});

			if (response.ok) {
				toast.success("Ticket marked as resolved");
				router.refresh();
				// Clear optimistic status after refresh
				setTimeout(() => setOptimisticStatus(null), 100);
			} else {
				// Rollback optimistic update
				setOptimisticStatus(null);
				if (onStatusChanged) {
					onStatusChanged(currentStatus);
				}
				const error = await response.json().catch(() => ({ error: "Failed to mark ticket as resolved" }));
				toast.error(error.error || "Failed to mark ticket as resolved");
			}
		} catch (error) {
			// Rollback optimistic update
			setOptimisticStatus(null);
			if (onStatusChanged) {
				onStatusChanged(currentStatus);
			}
			logger.error("Error marking ticket as resolved", error, { component: "AdminActions", action: "markResolved" });
			toast.error("Failed to mark ticket as resolved. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	// handleDelete function removed


	const handleForward = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading("forward");
		try {
			const body: Record<string, unknown> = { reason: forwardReason || undefined };
			if (selectedForwardAdmin && selectedForwardAdmin !== "auto") {
				body.targetAdminId = selectedForwardAdmin;
			}

			const response = await fetch(`/api/tickets/${ticketId}/forward`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (response.ok) {
				const data = await response.json();
				setForwardReason("");
				setSelectedForwardAdmin("auto");
				setShowForwardDialog(false);
				toast.success(data.message || "Ticket forwarded successfully");
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to forward ticket" }));
				toast.error(error.error || "Failed to forward ticket");
			}
		} catch (error) {
			logger.error("Error forwarding ticket", error, { component: "AdminActions", action: "forward", ticketId });
			toast.error("Failed to forward ticket. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	// handleEscalate function removed

	return (
		<div className="border-t pt-4 space-y-4">
			<label className="text-sm font-medium text-muted-foreground block">
				👨‍💼 Admin Actions
			</label>

			<div className="flex flex-wrap gap-2">
				{normalizedStatus !== "in_progress" && normalizedStatus !== "awaiting_student" && (
					<Button
						variant="outline"
						onClick={handleMarkInProgress}
						disabled={loading !== null}
					>
						{loading === "mark" ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Marking...
							</>
						) : (
							<>
								<RefreshCw className="w-4 h-4 mr-2" />
								Mark In Progress (48h TAT)
							</>
						)}
					</Button>
				)}

				{showCustomTat && (
					<form onSubmit={handleSetTAT} className="flex gap-2 items-end w-full sm:w-auto">
						<div className="flex-1">
							<Label htmlFor="tat">Turnaround Time (TAT)</Label>
							<Input
								id="tat"
								value={tat}
								onChange={(e) => setTat(e.target.value)}
								placeholder="e.g., 2 hours, 1 day, 3 days"
								required
							/>
						</div>
						<Button type="submit" disabled={loading === "tat"}>
							{loading === "tat" ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin mr-2" />
									Setting...
								</>
							) : (
								"Update"
							)}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setShowCustomTat(false);
								setTat("");
							}}
						>
							Cancel
						</Button>
					</form>
				)}

				{/* Show Extend TAT button if already in progress with TAT */}
				{!showCustomTat && normalizedStatus === "in_progress" && hasTAT && (
					<Button
						variant="outline"
						onClick={() => {
							setTat("");
							setShowCustomTat(true);
						}}
					>
						<Clock className="w-4 h-4 mr-2" />
						Extend TAT
					</Button>
				)}

				{!showCustomTat && normalizedStatus !== "in_progress" && (
					<Button
						variant="ghost"
						onClick={() => {
							setTat("");
							setShowCustomTat(true);
						}}
						className="text-xs sm:text-sm"
					>
						Set custom TAT before starting
					</Button>
				)}

				{showCommentForm && (
					<form onSubmit={handleAddComment} className="space-y-2 flex-1 w-full">
						<div>
							<Label htmlFor="adminComment">
								{commentType === "internal"
									? "Internal Note"
									: commentType === "super_admin"
										? "Super Admin Note"
										: "Admin Comment"}
							</Label>
							<Textarea
								id="adminComment"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder={
									commentType === "internal"
										? "This note is visible only to admins and committees..."
										: "Enter your comment..."
								}
								rows={3}
								required
							/>
						</div>
						<div className="flex gap-2">
							<Button type="submit" disabled={loading === "comment"}>
								{loading === "comment" ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin mr-2" />
										Sending...
									</>
								) : (
									commentType === "internal" ? "Save Note" : "Add Comment"
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setShowCommentForm(false);
									setComment("");
									setCommentType("comment");
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				)}


				{/* Delete ticket removed for super admin */}

				{/* Internal Note Button */}
				<Button
					variant="outline"
					onClick={() => {
						setShowCommentForm(true);
						setCommentType("internal");
					}}
					disabled={loading !== null}
				>
					<FileText className="w-4 h-4 mr-2" />
					Internal Note
				</Button>

				{/* Reassign - only for super admin */}
				{isSuperAdmin && (
					<>
					<ReassignDialog
						open={showReassignDialog}
						onOpenChange={setShowReassignDialog}
						ticketId={ticketId}
						currentAssignedTo={currentAssignedTo}
						onReassigned={() => router.refresh()}
					/>
						<Button
							variant="outline"
							disabled={loading !== null}
							onClick={() => setShowReassignDialog(true)}
						>
							<UserCog className="w-4 h-4 mr-2" />
							Reassign
						</Button>
					</>
				)}

				{/* Escalate Ticket removed */}

				{/* Forward to Next Level */}
				{normalizedStatus !== "resolved" && (
					<Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								disabled={loading !== null}
							>
								<ArrowUpRight className="w-4 h-4 mr-2" />
								Forward
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Forward Ticket</DialogTitle>
								<DialogDescription>
									Forward this ticket to the next level admin for handling.
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={handleForward} className="space-y-4">
								<div>
									<Label htmlFor="forwardReason">Reason (Optional)</Label>
									<Textarea
										id="forwardReason"
										value={forwardReason}
										onChange={(e) => setForwardReason(e.target.value)}
										placeholder="e.g., Requires senior admin approval, Beyond my scope..."
										rows={3}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="forwardTarget">Forward To</Label>
									{hasForwardTargets ? (
										<>
											<Select
												value={selectedForwardAdmin}
												onValueChange={setSelectedForwardAdmin}
												disabled={loading === "forward"}
											>
												<SelectTrigger id="forwardTarget">
													<SelectValue placeholder="Select admin or use auto-selection" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="auto">Automatic (choose best super admin)</SelectItem>
													{forwardTargets.map((admin) => (
														<SelectItem key={admin.id} value={admin.id}>
															<span className="flex flex-col">
																<span className="font-medium">{admin.name}</span>
																<span className="text-xs text-muted-foreground">{admin.email || "No email"}</span>
															</span>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												Leave on <span className="font-medium">Automatic</span> to let the system pick the next-level (super admin) automatically.
											</p>
										</>
									) : (
										<p className="text-sm text-muted-foreground">
											This will forward to the default super admin assigned for escalations.
										</p>
									)}
								</div>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShowForwardDialog(false);
											setForwardReason("");
											setSelectedForwardAdmin("auto");
										}}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={loading === "forward"}>
										{loading === "forward" ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin mr-2" />
												Forwarding...
											</>
										) : (
											"Forward"
										)}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				)}


				{/* Mark as Resolved */}
				{normalizedStatus !== "resolved" && (
					<Button
						variant="default"
						onClick={handleMarkResolved}
						disabled={loading !== null}
						className="bg-green-600 hover:bg-green-700 text-white"
					>
						<CheckCircle className="w-4 h-4 mr-2" />
						{loading === "resolved" ? "Marking..." : "Mark as Resolved"}
					</Button>
				)}
			</div>
		</div>
	);
}
