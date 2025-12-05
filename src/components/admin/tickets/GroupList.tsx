"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Clock, Search, Users, Loader2 } from "lucide-react";
import { GroupActions } from "./GroupActions";
import { cn } from "@/lib/utils";

interface Ticket {
  id: number;
  status: string | null;
  description: string | null;
  location?: string | null;
  created_at: Date | string;
  category_name?: string | null;
  resolution_due_at?: Date | string | null;
  metadata?: {
    tatDate?: string;
    tat?: string;
  } | null;
}

interface TicketGroup {
  id: number;
  name: string;
  description: string | null;
  created_at: Date | string;
  is_archived: boolean;
  tickets: Ticket[];
  ticketCount: number;
}

interface GroupListProps {
  groups: TicketGroup[];
  filteredGroups: TicketGroup[];
  displayedGroups: TicketGroup[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  activeGroupsCount: number;
  archivedGroupsCount: number;
  onManageTickets: (group: TicketGroup) => void;
  onBulkActions: (groupId: number) => void;
  onDelete: (groupId: number) => void;
}

export function GroupList({
  groups,
  filteredGroups,
  displayedGroups,
  loading,
  searchQuery,
  onSearchChange,
  showArchived,
  onShowArchivedChange,
  activeGroupsCount,
  archivedGroupsCount,
  onManageTickets,
  onBulkActions,
  onDelete,
}: GroupListProps) {
  if (loading && groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading groups...</p>
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No ticket groups yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select tickets and create a group to manage them together
          </p>
        </CardContent>
      </Card>
    );
  }

  if (filteredGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="font-medium mb-1">No groups found</p>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "Try adjusting your search query" : "Create a group to get started"}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSearchChange("")}
              className="mt-4"
            >
              Clear Search
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      {groups.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search groups by name, description, or ticket ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {activeGroupsCount} active group{activeGroupsCount !== 1 ? "s" : ""}
          {archivedGroupsCount > 0 && (
            <span className="ml-2">
              • {archivedGroupsCount} archived
            </span>
          )}
          {searchQuery && (
            <span className="ml-2 text-primary">
              • {filteredGroups.length} result{filteredGroups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {filteredGroups.some(g => g.is_archived) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowArchivedChange(!showArchived)}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? "Hide" : "Show"} Archived
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayedGroups.map((group) => {
          // Calculate group TAT from tickets
          const groupTATInfo = (() => {
            if (!group.tickets || group.tickets.length === 0) return null;
            
            const tatDates: Date[] = [];
            const tatTexts: string[] = [];
            
            group.tickets.forEach(ticket => {
              if (ticket.resolution_due_at) {
                const date = ticket.resolution_due_at instanceof Date 
                  ? ticket.resolution_due_at 
                  : new Date(ticket.resolution_due_at);
                if (!isNaN(date.getTime())) {
                  tatDates.push(date);
                }
              }
              
              if (ticket.metadata && typeof ticket.metadata === 'object') {
                const metadata = ticket.metadata as { tatDate?: string; tat?: string };
                if (metadata.tatDate) {
                  const date = new Date(metadata.tatDate);
                  if (!isNaN(date.getTime())) {
                    tatDates.push(date);
                  }
                }
                if (metadata.tat) {
                  tatTexts.push(metadata.tat);
                }
              }
            });
            
            if (tatDates.length === 0) return null;
            
            const earliestDate = new Date(Math.min(...tatDates.map(d => d.getTime())));
            const now = new Date();
            const diff = (earliestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            const diffDays = Math.round(diff);
            
            let label = "";
            let isOverdue = false;
            
            if (diffDays < 0) {
              isOverdue = true;
              label = `${Math.abs(diffDays)} days overdue`;
            } else if (diffDays === 0) {
              label = "Due today";
            } else if (diffDays === 1) {
              label = "Due tomorrow";
            } else if (diffDays <= 7) {
              label = `Due in ${diffDays} days`;
            } else {
              label = earliestDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            }
            
            const mostCommonTAT = tatTexts.length > 0 
              ? tatTexts.sort((a, b) => 
                  tatTexts.filter(v => v === a).length - tatTexts.filter(v => v === b).length
                ).pop() || null
              : null;
            
            return { label, isOverdue, tatText: mostCommonTAT };
          })();

          return (
            <Card 
              key={group.id} 
              className={cn(
                "relative transition-all hover:shadow-md",
                group.is_archived ? "opacity-60 border-dashed" : "hover:border-primary/50"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.is_archived && (
                        <Badge variant="secondary" className="text-xs">
                          <Archive className="w-3 h-3 mr-1" />
                          Archived
                        </Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="secondary">
                      {group.ticketCount} ticket{group.ticketCount !== 1 ? "s" : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.created_at ? new Date(group.created_at).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  {groupTATInfo && (
                    <div className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border",
                      groupTATInfo.isOverdue
                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                    )}>
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1">{groupTATInfo.label}</span>
                      {groupTATInfo.tatText && (
                        <span className="text-[10px] opacity-75 ml-1">
                          ({groupTATInfo.tatText})
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {group.tickets.slice(0, 3).map((ticket) => (
                      <div key={ticket.id} className="text-sm flex items-center justify-between p-1.5 rounded-md hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground font-mono">#{ticket.id}</span>
                        {ticket.category_name && (
                          <Badge variant="outline" className="text-xs">
                            {ticket.category_name}
                          </Badge>
                        )}
                      </div>
                    ))}
                    {group.tickets.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-1.5">
                        +{group.tickets.length - 3} more ticket{group.tickets.length - 3 !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {!group.is_archived && (
                    <GroupActions
                      onManageTickets={() => onManageTickets(group)}
                      onBulkActions={() => onBulkActions(group.id)}
                      onDelete={() => onDelete(group.id)}
                    />
                  )}
                  {group.is_archived && (
                    <div className="text-xs text-center text-muted-foreground py-2">
                      All tickets resolved
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
