"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

interface AcknowledgeButtonProps {
  ticketId: number;
  isAcknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  onAcknowledged?: () => void;
}

export function AcknowledgeButton({
  ticketId,
  isAcknowledged,
  acknowledgedBy,
  acknowledgedAt,
  onAcknowledged,
}: AcknowledgeButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [acknowledgementTat, setAcknowledgementTat] = useState("");

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/acknowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message || undefined,
          acknowledgementTat: acknowledgementTat || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to acknowledge ticket");
      }

      setOpen(false);
      setMessage("");
      setAcknowledgementTat("");
      if (onAcknowledged) {
        onAcknowledged();
      }
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Error acknowledging ticket:", error);
      alert(error instanceof Error ? error.message : "Failed to acknowledge ticket");
    } finally {
      setLoading(false);
    }
  };

  if (isAcknowledged) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span>
          Acknowledged
          {acknowledgedAt && ` on ${new Date(acknowledgedAt).toLocaleDateString()}`}
        </span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Acknowledge Ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acknowledge Ticket</DialogTitle>
          <DialogDescription>
            Acknowledge this ticket and optionally set an acknowledgement TAT.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="message">Acknowledgement Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="e.g., We have received your ticket and are working on it..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="acknowledgementTat">Acknowledgement TAT (Optional)</Label>
            <Input
              id="acknowledgementTat"
              placeholder="e.g., 2 hours, 1 day, 3 days"
              value={acknowledgementTat}
              onChange={(e) => setAcknowledgementTat(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Expected time to acknowledge (e.g., "2 hours", "1 day")
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAcknowledge} disabled={loading}>
            {loading ? "Acknowledging..." : "Acknowledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

