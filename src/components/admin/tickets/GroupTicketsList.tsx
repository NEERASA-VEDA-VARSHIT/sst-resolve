"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, Clock, MapPin, Calendar, ExternalLink, FileText, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  REOPENED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  AWAITING_STUDENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ESCALATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

interface Ticket {
  id: number;
  status: string | null;
  description: string | null;
  location?: string | null;
  category_name?: string | null;
  due_at?: Date | string | null;
  resolution_due_at?: Date | string | null;
  metadata?: {
    tatDate?: string;
    tat?: string;
  } | null;
  created_at: Date | string;
  updated_at?: Date | string | null;
}

interface GroupTicketsListProps {
  tickets: Ticket[];
  selectedTickets: number[];
  onToggleTicket: (ticketId: number) => void;
  onRemoveTickets: () => Promise<void>;
  loading: boolean;
}

// Helper function to compute TAT info
const computeTatInfo = (date?: Date | null, status?: string | null) => {
  if (!date) return { overdue: false, label: null };

  const normalizedStatus = status ? status.toLowerCase() : "";
  const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed";
  if (isResolved) {
    return { overdue: false, label: null };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diff = (tatDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const diffDays = Math.round(diff);

  if (diffDays < 0) return { overdue: true, label: `${Math.abs(diffDays)} days overdue` };
  if (diffDays === 0) return { overdue: false, label: "Due today" };
  if (diffDays === 1) return { overdue: false, label: "Due tomorrow" };
  if (diffDays <= 7) return { overdue: false, label: `Due in ${diffDays} days` };

  return {
    overdue: false,
    label: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
};

// Helper to get TAT date from ticket
const getTatDate = (ticket: Ticket): Date | null => {
  const metadata = (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata))
    ? ticket.metadata as { tatDate?: string; tat?: string }
    : null;
  
  if (ticket.due_at) {
    const date = ticket.due_at instanceof Date ? ticket.due_at : new Date(ticket.due_at);
    if (!isNaN(date.getTime())) return date;
  }
  if (ticket.resolution_due_at) {
    const date = ticket.resolution_due_at instanceof Date ? ticket.resolution_due_at : new Date(ticket.resolution_due_at);
    if (!isNaN(date.getTime())) return date;
  }
  if (metadata?.tatDate) {
    const date = new Date(metadata.tatDate);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
};

export function GroupTicketsList({
  tickets,
  selectedTickets,
  onToggleTicket,
  onRemoveTickets,
  loading,
}: GroupTicketsListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.id.toString().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.location?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search tickets by ID, description, location, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Tickets List */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Tickets in Group
              <Badge variant="secondary" className="ml-2">
                {filteredTickets.length}{tickets.length !== filteredTickets.length ? ` of ${tickets.length}` : ''}
              </Badge>
            </CardTitle>
            {selectedTickets.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onRemoveTickets}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Remove ({selectedTickets.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] px-4">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Package className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchQuery ? "No tickets found" : "No tickets in group"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((ticket) => {
                  const tatDate = getTatDate(ticket);
                  const tatInfo = computeTatInfo(tatDate, ticket.status || null);
                  const isSelected = selectedTickets.includes(ticket.id);

                  return (
                    <div
                      key={ticket.id}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer mb-2",
                        isSelected
                          ? "bg-destructive/5 border-destructive/50 shadow-sm"
                          : "bg-card hover:bg-accent/50 hover:border-destructive/30"
                      )}
                      onClick={() => onToggleTicket(ticket.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleTicket(ticket.id)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="text-sm font-mono font-semibold text-primary">#{ticket.id}</span>
                            {ticket.status && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs font-semibold border",
                                  STATUS_STYLES[ticket.status.toUpperCase()] || "bg-muted text-foreground"
                                )}
                              >
                                {ticket.status.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Badge>
                            )}
                            {ticket.category_name && (
                              <Badge variant="secondary" className="text-xs">
                                📁 {ticket.category_name}
                              </Badge>
                            )}
                            {tatDate && tatInfo.label && (
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 font-semibold px-2 py-1 rounded-md text-xs flex-shrink-0",
                                  tatInfo.overdue
                                    ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                )}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span className="whitespace-nowrap">{tatInfo.label}</span>
                              </div>
                            )}
                          </div>
                          <a
                            href={`/admin/dashboard/ticket/${ticket.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        {ticket.description && (
                          <div className="mb-2">
                            <div className="flex items-start gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                {ticket.description}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1.5">
                          {ticket.location && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                              <MapPin className="w-3 h-3" />
                              <span className="font-medium">{ticket.location}</span>
                            </div>
                          )}
                          {ticket.created_at && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {format(new Date(ticket.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
