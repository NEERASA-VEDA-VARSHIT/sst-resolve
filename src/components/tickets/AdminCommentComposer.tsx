"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircleQuestion, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

interface AdminCommentComposerProps {
  ticketId: number;
}

export function AdminCommentComposer({ ticketId }: AdminCommentComposerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"comment" | "question" | null>(null);

  const handleSubmit = async (action: "comment" | "question") => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setLoading(action);
    try {
      if (action === "question") {
        const statusResponse = await fetch(`/api/tickets/${ticketId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "awaiting_student_response" }),
        });

        if (!statusResponse.ok) {
          const statusError = await statusResponse.json().catch(() => ({ error: "Failed to update status" }));
          throw new Error(statusError.error || "Failed to send question");
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: message.trim(),
          isAdmin: true,
          commentType: "student_visible",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to send comment" }));
        throw new Error(error.error || "Failed to send comment");
      }

      setMessage("");
      router.refresh();
      toast.success(action === "question" ? "Question sent to student" : "Comment added");
    } catch (error) {
      console.error("Comment composer error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
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


