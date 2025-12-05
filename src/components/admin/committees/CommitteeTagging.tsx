"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, X, Plus, Loader2 } from "lucide-react";

interface Committee {
  id: number;
  name: string;
  description: string | null;
}

interface CommitteeTag {
  id: number;
  ticket_id: number;
  committee_id: number;
  tagged_by: string | null;
  reason: string | null;
  created_at: Date | string;
  committee: {
    id: number;
    name: string;
    description: string | null;
  };
}

interface CommitteeTaggingProps {
  ticketId: number;
  onTagAdded?: () => void;
  onTagRemoved?: () => void;
}

export function CommitteeTagging({ ticketId, onTagAdded, onTagRemoved }: CommitteeTaggingProps) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [tags, setTags] = useState<CommitteeTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>("");
  const [reason, setReason] = useState("");

  const fetchCommittees = useCallback(async () => {
    try {
      const response = await fetch("/api/committees");
      if (response.ok) {
        const data = await response.json();
        setCommittees(data.committees || []);
      } else {
        console.error("Failed to fetch committees:", response.status);
        // Don't show error toast, just log it
      }
    } catch (error) {
      console.error("Error fetching committees:", error);
      // Don't show error toast, just log it
    }
  }, []); // No dependencies - committees list doesn't change based on ticketId

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/committee-tags`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  }, [ticketId]); // Only refetch when ticketId changes

  useEffect(() => {
    // Fetch both in parallel for better performance
    Promise.all([fetchCommittees(), fetchTags()]).catch((error) => {
      console.error("Error fetching committee data:", error);
    });
  }, [fetchCommittees, fetchTags]); // Now these functions are stable

  const handleAddTag = async () => {
    if (!selectedCommitteeId) {
      toast.error("Please select a committee");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${ticketId}/committee-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committee_id: parseInt(selectedCommitteeId, 10),
          reason: reason.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success("Ticket tagged to committee successfully");
        setSelectedCommitteeId("");
        setReason("");
        setIsDialogOpen(false);
        fetchTags();
        onTagAdded?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to tag ticket");
      }
    } catch (error) {
      console.error("Error tagging ticket:", error);
      toast.error("Failed to tag ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!confirm("Are you sure you want to remove this committee tag?")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${ticketId}/committee-tags?tagId=${tagId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Committee tag removed successfully");
        fetchTags();
        onTagRemoved?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to remove tag");
      }
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error("Failed to remove tag");
    } finally {
      setLoading(false);
    }
  };

  // Filter out already tagged committees
  const availableCommittees = committees.filter(
    (committee) => !tags.some((tag) => tag.committee_id === committee.id)
  );

  // Show button as disabled only if there are committees but all are tagged
  // If there are no committees at all, show button but it will show message in dialog
  const isButtonDisabled = committees.length > 0 && availableCommittees.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Committee Tags
        </Label>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isButtonDisabled}>
              <Plus className="w-4 h-4 mr-2" />
              Tag Committee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tag Ticket to Committee</DialogTitle>
              <DialogDescription>
                Tag this ticket to a committee so they can step in and resolve it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="committee">Committee *</Label>
                <Select value={selectedCommitteeId} onValueChange={setSelectedCommitteeId}>
                  <SelectTrigger id="committee">
                    <SelectValue placeholder="Select a committee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCommittees.map((committee) => (
                      <SelectItem key={committee.id} value={committee.id.toString()}>
                        {committee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {committees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No committees available. Please create committees first.
                  </p>
                ) : availableCommittees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All committees have been tagged to this ticket
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this ticket being tagged to this committee? (e.g., Resolution was already discussed with this committee)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTag} disabled={loading || !selectedCommitteeId}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Tagging...
                  </>
                ) : (
                  "Tag Committee"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No committees tagged. Tag a committee to allow them to step in and resolve this ticket.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="flex items-center gap-2 py-1.5 px-3">
              <Users className="w-3 h-3" />
              <span>{tag.committee.name}</span>
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={loading}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

