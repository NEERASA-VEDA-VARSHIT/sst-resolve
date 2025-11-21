"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Clock, MessageSquare, CheckCircle, RotateCcw, Trash2, FileText, UserCog, AlertTriangle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { ReassignDialog } from "./ReassignDialog";
import { normalizeStatusForComparison } from "@/lib/utils";

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
	ticketCategory,
	ticketLocation,
	currentAssignedTo,
	forwardTargets = [],
}: {
	ticketId: number;
	currentStatus: string;
	hasTAT?: boolean;
	isSuperAdmin?: boolean;
	ticketCategory: string;
	ticketLocation?: string | null;
	currentAssignedTo?: string | null;
	forwardTargets?: ForwardTarget[];
}) {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);
	const [showTATForm, setShowTATForm] = useState(false);
	const [showCommentForm, setShowCommentForm] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showReassignDialog, setShowReassignDialog] = useState(false);
	const [showEscalateDialog, setShowEscalateDialog] = useState(false);
	const [showForwardDialog, setShowForwardDialog] = useState(false);
	const [tat, setTat] = useState("");
	const [comment, setComment] = useState("");
	const [escalationReason, setEscalationReason] = useState("");
	const [forwardReason, setForwardReason] = useState("");
	const [selectedForwardAdmin, setSelectedForwardAdmin] = useState<string>("auto");
	const [commentType, setCommentType] = useState<"comment" | "question" | "internal" | "super_admin">("comment");

	// Normalize status for comparison (handles both uppercase enum and lowercase constants)
	const normalizedStatus = normalizeStatusForComparison(currentStatus);
	const hasForwardTargets = Array.isArray(forwardTargets) && forwardTargets.length > 0;

	useEffect(() => {
		if (!showForwardDialog) {
			setSelectedForwardAdmin("auto");
		}
	}, [showForwardDialog]);

	const handleStatusUpdate = async (status: string) => {
		setLoading(status);
		try {
			const response = await fetch(`/api/tickets/${ticketId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});

			if (response.ok) {
				toast.success(`Ticket status updated successfully`);
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to update ticket status" }));
				toast.error(error.error || "Failed to update ticket status");
			}
		} catch (error) {
			console.error("Error updating status:", error);
			toast.error("Failed to update ticket status. Please try again.");
		} finally {
			setLoading(null);
		}
	};

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
				setShowTATForm(false);
				toast.success("TAT set successfully");
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to set TAT" }));
				toast.error(error.error || "Failed to set TAT");
			}
		} catch (error) {
			console.error("Error setting TAT:", error);
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
			console.error("Error adding comment:", error);
			toast.error("Failed to add comment. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	const handleMarkResolved = async () => {
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
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to mark ticket as resolved" }));
				toast.error(error.error || "Failed to mark ticket as resolved");
			}
		} catch (error) {
			console.error("Error marking ticket as resolved:", error);
			toast.error("Failed to mark ticket as resolved. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	const handleDelete = async () => {
		setLoading("delete");
		setShowDeleteDialog(false);
		try {
			const response = await fetch(`/api/tickets/${ticketId}`, {
				method: "DELETE",
			});
			if (response.ok) {
				toast.success("Ticket deleted successfully");
				router.push("/admin");
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to delete ticket" }));
				toast.error(error.error || "Failed to delete ticket");
			}
		} catch (error) {
			console.error("Error deleting ticket:", error);
			toast.error("Failed to delete ticket. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	const handleEscalate = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading("escalate");
		try {
			const response = await fetch(`/api/tickets/${ticketId}/escalate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason: escalationReason || undefined }),
			});

			if (response.ok) {
				const data = await response.json();
				setEscalationReason("");
				setShowEscalateDialog(false);
				toast.success(`Ticket escalated successfully (Escalation #${data.escalationCount})`);
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to escalate ticket" }));
				toast.error(error.error || "Failed to escalate ticket");
			}
		} catch (error) {
			console.error("Error escalating ticket:", error);
			toast.error("Failed to escalate ticket. Please try again.");
		} finally {
			setLoading(null);
		}
	};

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
			console.error("Error forwarding ticket:", error);
			toast.error("Failed to forward ticket. Please try again.");
		} finally {
			setLoading(null);
		}
	};

	return (
		<div className="border-t pt-4 space-y-4">
			<label className="text-sm font-medium text-muted-foreground block">
				👨‍💼 Admin Actions
			</label>

			<div className="flex flex-wrap gap-2">
				{/* Show TAT form when marking in progress or extending TAT */}
				{showTATForm ? (
					<form onSubmit={handleSetTAT} className="flex gap-2 items-end">
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
							{loading === "tat" ? "Setting..." : "Set"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setShowTATForm(false);
								setTat("");
							}}
						>
							Cancel
						</Button>
					</form>
				) : (
					// Show Mark In Progress button if not in progress
					normalizedStatus !== "in_progress" && (
						<Button
							variant="outline"
							onClick={() => setShowTATForm(true)}
							disabled={loading !== null}
						>
							<RefreshCw className="w-4 h-4 mr-2" />
							Mark In Progress
						</Button>
					)
				)}

				{/* Show Extend TAT button if already in progress with TAT */}
				{!showTATForm && normalizedStatus === "in_progress" && hasTAT && (
					<Button
						variant="outline"
						onClick={() => setShowTATForm(true)}
					>
						<Clock className="w-4 h-4 mr-2" />
						Extend TAT
					</Button>
				)}

				{/* Ask Question Button - sets status to awaiting_student_response */}
				{normalizedStatus !== "resolved" && (
					<Button
						variant="outline"
						onClick={() => {
							setShowCommentForm(true);
							setCommentType("question");
						}}
						disabled={loading !== null}
					>
						<MessageSquare className="w-4 h-4 mr-2" />
						Ask Question
					</Button>
				)}

				{/* Add Comment Button */}
				{!showCommentForm && (
					<Button
						variant="outline"
						onClick={() => {
							setShowCommentForm(true);
							setCommentType("comment");
						}}
					>
						<MessageSquare className="w-4 h-4 mr-2" />
						Add Comment
					</Button>
				)}

				{showCommentForm && (
					<form onSubmit={handleAddComment} className="space-y-2 flex-1 w-full">
						<div>
							<Label htmlFor="adminComment">
								{commentType === "question" ? "Ask Question (Student will be notified)" : "Admin Comment"}
							</Label>
							<Textarea
								id="adminComment"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder={commentType === "question" ? "Enter your question for the student..." : "Enter your comment..."}
								rows={3}
								required
							/>
						</div>
						<div className="flex gap-2">
							<Button type="submit" disabled={loading === "comment"}>
								{loading === "comment" ? "Sending..." : commentType === "question" ? "Ask Question" : "Add Comment"}
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


				{/* Delete ticket - only for super admin */}
				{isSuperAdmin && (
					<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
						<DialogTrigger asChild>
							<Button
								variant="destructive"
								disabled={loading === "delete"}
							>
								<Trash2 className="w-4 h-4 mr-2" />
								Delete Ticket
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Delete Ticket</DialogTitle>
								<DialogDescription>
									Are you sure you want to permanently delete ticket #{ticketId}? This action cannot be undone.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
									Cancel
								</Button>
								<Button variant="destructive" onClick={handleDelete} disabled={loading === "delete"}>
									{loading === "delete" ? "Deleting..." : "Delete"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}

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
							ticketCategory={ticketCategory}
							ticketLocation={ticketLocation}
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
										{loading === "forward" ? "Forwarding..." : "Forward"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				)}

				{/* Manual Escalation */}
				{normalizedStatus !== "resolved" && (
					<Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								disabled={loading !== null}
							>
								<AlertTriangle className="w-4 h-4 mr-2" />
								Escalate
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Escalate Ticket</DialogTitle>
								<DialogDescription>
									Escalate this ticket to a higher level. This will notify super admins and mark as ESCALATED.
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={handleEscalate} className="space-y-4">
								<div>
									<Label htmlFor="escalationReason">Reason (Optional)</Label>
									<Textarea
										id="escalationReason"
										value={escalationReason}
										onChange={(e) => setEscalationReason(e.target.value)}
										placeholder="e.g., Requires urgent attention, Complex issue beyond scope..."
										rows={3}
									/>
								</div>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShowEscalateDialog(false);
											setEscalationReason("");
										}}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={loading === "escalate"}>
										{loading === "escalate" ? "Escalating..." : "Escalate"}
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

