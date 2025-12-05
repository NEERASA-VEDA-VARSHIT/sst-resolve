"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircleQuestion, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { AriaLiveRegion } from "@/lib/ui/aria-live-region";

interface AdminCommentComposerProps {
  ticketId: number;
  onCommentAdded?: (comment: { text: string; source: string; createdAt: Date }) => void;
  onStatusChanged?: (newStatus: string) => void;
}

export function AdminCommentComposer({ ticketId, onCommentAdded, onStatusChanged }: AdminCommentComposerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"comment" | "question" | null>(null);

  const handleSubmit = async (action: "comment" | "question") => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    const messageText = message.trim();
    const optimisticComment = {
      text: messageText,
      source: "admin",
      createdAt: new Date(),
    };

    // Optimistic updates - update UI immediately
    if (onCommentAdded) {
      onCommentAdded(optimisticComment);
    }
    
    if (action === "question" && onStatusChanged) {
      onStatusChanged("awaiting_student_response");
    }

    setMessage("");
    setLoading(action);

    try {
      if (action === "question") {
        const statusResponse = await fetch(`/api/tickets/${ticketId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "awaiting_student_response" }),
        });

        if (!statusResponse.ok) {
          // Rollback optimistic status change
          if (onStatusChanged) {
            // Status will be refreshed from server, so we don't need to rollback explicitly
          }
          const statusError = await statusResponse.json().catch(() => ({ error: "Failed to update status" }));
          throw new Error(statusError.error || "Failed to send question");
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: messageText,
          isAdmin: true,
          commentType: "student_visible",
        }),
      });

      if (!response.ok) {
        // Rollback optimistic comment (will be handled by parent component refresh)
        const error = await response.json().catch(() => ({ error: "Failed to send comment" }));
        throw new Error(error.error || "Failed to send comment");
      }

      router.refresh();
      toast.success(action === "question" ? "Question sent to student" : "Comment added");
    } catch (error) {
      logger.error("Comment composer error", error, { component: "AdminCommentComposer", ticketId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      // Restore message on error
      setMessage(messageText);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <AriaLiveRegion
        loading={loading !== null}
        loadingMessage={loading === "comment" ? "Adding comment..." : loading === "question" ? "Sending question..." : undefined}
        success={false}
        error={false}
      />
      <div>
        <p className="text-sm font-semibold text-foreground">Send an update</p>
        <p className="text-xs text-muted-foreground">
          Students receive an email + dashboard notification for every message
        </p>
      </div>

      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Type your update or question for the student..."
        rows={4}
        className="resize-none"
        disabled={loading !== null}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => handleSubmit("comment")}
          disabled={loading !== null || message.trim().length === 0}
        >
          {loading === "comment" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Add Comment
            </>
          )}
        </Button>

        <Button
          variant="default"
          onClick={() => handleSubmit("question")}
          disabled={loading !== null || message.trim().length === 0}
          className="bg-primary text-primary-foreground"
        >
          {loading === "question" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MessageCircleQuestion className="w-4 h-4 mr-2" />
              Ask Question
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

