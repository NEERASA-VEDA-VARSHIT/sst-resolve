"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CommentFormProps {
	ticketId: number;
	currentStatus?: string;
}

export function CommentForm({ ticketId, currentStatus }: CommentFormProps) {
	const router = useRouter();
	const [comment, setComment] = useState("");
	const [loading, setLoading] = useState(false);

	// Check if student can reply (only when status is "awaiting_student_response")
	const canReply = currentStatus === "awaiting_student_response";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!comment.trim()) return;

		// Check if student is trying to reply when not allowed
		if (!canReply && currentStatus !== "open" && currentStatus !== "in_progress") {
			toast.error("You can only reply when the admin has asked a question. Current status: " + currentStatus);
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`/api/tickets/${ticketId}/comment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ comment }),
			});

			if (response.ok) {
				setComment("");
				toast.success("Comment added successfully");
				router.refresh(); // Refresh to show new comment
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to add comment" }));
				toast.error(error.error || "Failed to add comment");
			}
		} catch (error) {
			console.error("Error adding comment:", error);
			toast.error("Failed to add comment. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	// Hide form if student can't reply
	if (!canReply && currentStatus && currentStatus !== "open" && currentStatus !== "in_progress") {
		return (
			<div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
				You can only reply when the admin has asked a question. Current status: <strong>{currentStatus.replace('_', ' ')}</strong>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2">
			<Textarea
				placeholder={canReply ? "Reply to admin's question..." : "Add a comment..."}
				value={comment}
				onChange={(e) => setComment(e.target.value)}
				rows={3}
				disabled={loading}
			/>
			<Button type="submit" disabled={loading || !comment.trim()}>
				{loading ? "Adding..." : canReply ? "Send Reply" : "Add Comment"}
			</Button>
		</form>
	);
}

