"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Clock } from "lucide-react";
import { toast } from "sonner";

interface Committee {
  id: number;
  name: string;
  description: string | null;
}

interface GroupSettingsSectionProps {
  currentCommittee: Committee | null;
  committees: Committee[];
  loadingCommittees: boolean;
  onCommitteeChange: (committeeId: number | null) => Promise<void>;
  onTATChange: (tat: string) => Promise<void>;
}

export function GroupSettingsSection({
  currentCommittee,
  committees,
  loadingCommittees,
  onCommitteeChange,
  onTATChange,
}: GroupSettingsSectionProps) {
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>(
    currentCommittee ? String(currentCommittee.id) : ""
  );
  const [groupTAT, setGroupTAT] = useState("");
  const [loadingTAT, setLoadingTAT] = useState(false);
  const [loadingCommitteeUpdate, setLoadingCommitteeUpdate] = useState(false);

  const handleSetCommittee = async () => {
    try {
      setLoadingCommitteeUpdate(true);
      const committeeId = selectedCommitteeId === "" || selectedCommitteeId === "none" ? null : parseInt(selectedCommitteeId, 10);
      await onCommitteeChange(committeeId);
      toast.success(committeeId ? `Group assigned to committee` : `Committee assignment removed`);
    } catch (error) {
      toast.error("Failed to assign committee");
    } finally {
      setLoadingCommitteeUpdate(false);
    }
  };

  const handleSetGroupTAT = async () => {
    if (!groupTAT.trim()) {
      toast.error("Please enter a TAT value (e.g., '2 days', '1 week')");
      return;
    }

    try {
      setLoadingTAT(true);
      await onTATChange(groupTAT.trim());
      setGroupTAT("");
      toast.success(`TAT set for all tickets in group`);
    } catch (error) {
      toast.error("Failed to set group TAT");
    } finally {
      setLoadingTAT(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Group Committee Assignment */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Committee Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={selectedCommitteeId || "none"}
            onValueChange={setSelectedCommitteeId}
            disabled={loadingCommittees}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select a committee..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Committee</SelectItem>
              {committees.map((committee) => (
                <SelectItem key={committee.id} value={String(committee.id)}>
                  {committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSetCommittee}
            disabled={loadingCommitteeUpdate || loadingCommittees}
            className="w-full"
            size="sm"
          >
            {loadingCommitteeUpdate ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Assign Committee
              </>
            )}
          </Button>
          {currentCommittee && (
            <div className="px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Assigned to: {currentCommittee.name}
                </span>
              </div>
              {currentCommittee.description && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                  {currentCommittee.description}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group TAT Management */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Group TAT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="e.g., '2 days', '1 week', '3 hours'"
            value={groupTAT}
            onChange={(e) => setGroupTAT(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSetGroupTAT();
              }
            }}
            className="h-10"
          />
          <Button
            onClick={handleSetGroupTAT}
            disabled={loadingTAT || !groupTAT.trim()}
            className="w-full"
            size="sm"
          >
            {loadingTAT ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Set TAT for All Tickets
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            This will apply the TAT to all tickets currently in the group.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
