"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeStatusForComparison } from "@/lib/utils";

interface CommitteeActionsProps {
  ticketId: number;
  currentStatus: string;
  isTaggedTicket?: boolean;
}

export function CommitteeActions({ ticketId, currentStatus, isTaggedTicket = false }: CommitteeActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [comment, setComment] = useState("");

  const handleAddComment = async () => {
    if (!comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setLoading("comment");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: comment.trim(),
          commentType: "comment",
        }),
      });

      if (response.ok) {
        toast.success("Comment added successfully");
        setComment("");
        setShowCommentForm(false);
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to add comment" }));
        toast.error(error.error || "Failed to add comment");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setLoading(null);
    }
  };

  const handleCloseTicket = async () => {
    if (!comment.trim()) {
      toast.error("Please provide a resolution comment");
      return;
    }

    setLoading("close");
    try {
      // First add the comment
      const commentResponse = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: comment.trim(),
          commentType: "comment",
        }),
      });

      if (!commentResponse.ok) {
        const error = await commentResponse.json().catch(() => ({ error: "Failed to add comment" }));
        toast.error(error.error || "Failed to add comment");
        setLoading(null);
        return;
      }

      // Then close the ticket
      const statusResponse = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
        }),
      });

      if (statusResponse.ok) {
        toast.success("Ticket closed successfully");
        setComment("");
        setShowCloseDialog(false);
        router.refresh();
      } else {
        const error = await statusResponse.json().catch(() => ({ error: "Failed to close ticket" }));
        toast.error(error.error || "Failed to close ticket");
      }
    } catch (error) {
      console.error("Error closing ticket:", error);
      toast.error("Failed to close ticket");
    } finally {
      setLoading(null);
    }
  };

  // Normalize status for comparison (handles both uppercase enum and lowercase constants)
  const normalizedStatus = normalizeStatusForComparison(currentStatus);
  
  const canClose = isTaggedTicket && (normalizedStatus === "open" || normalizedStatus === "in_progress" || normalizedStatus === "reopened" || normalizedStatus === "awaiting_student_response");
  const canComment = isTaggedTicket || normalizedStatus !== "closed";

  if (!canComment && !canClose) {
    return null;
  }

  return (
    <div className="space-y-4">
      {isTaggedTicket && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Tagged Ticket:</strong> This ticket was tagged to your committee by an admin. You can step in and resolve it.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {canComment && (
          <Dialog open={showCommentForm} onOpenChange={setShowCommentForm}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" disabled={loading !== null}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Add Comment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Comment</DialogTitle>
                <DialogDescription>
                  Add a comment to this ticket
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment *</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter your comment..."
                    rows={4}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCommentForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddComment} disabled={loading !== null || !comment.trim()}>
                  {loading === "comment" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Comment"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canClose && (
          <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
            <DialogTrigger asChild>
              <Button variant="default" className="w-full" disabled={loading !== null}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Close Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Close Ticket</DialogTitle>
                <DialogDescription>
                  Provide a resolution comment and close this ticket
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="closeComment">Resolution Comment *</Label>
                  <Textarea
                    id="closeComment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explain how this issue was resolved..."
                    rows={4}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCloseTicket} disabled={loading !== null || !comment.trim()}>
                  {loading === "close" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Closing...
                    </>
                  ) : (
                    "Close Ticket"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

