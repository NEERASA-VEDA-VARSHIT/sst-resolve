import Link from "next/link";
import { Calendar, MapPin, User, Clock, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import type { tickets } from "@/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Ticket = typeof tickets.$inferSelect;

interface TicketCardProps {
  ticket: Ticket;
  basePath?: string; // e.g., "/student/dashboard" | "/admin/dashboard" | "/superadmin/dashboard"
}

export function TicketCard({ ticket, basePath = "/student/dashboard" }: TicketCardProps) {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'reopened':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'awaiting_student_response':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  // Parse ticket details for TAT and other info
  let tatDate: Date | null = null;
  let hasTATDue = false;
  let commentCount = 0;
  try {
    const details = ticket.details ? JSON.parse(String(ticket.details)) : {};
    if (details.tatDate) {
      tatDate = new Date(details.tatDate);
      // Check if TAT is overdue by comparing dates (not timestamps) to avoid timezone issues
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tatDay = new Date(tatDate.getFullYear(), tatDate.getMonth(), tatDate.getDate());
      hasTATDue = tatDay.getTime() < today.getTime();
    }
    if (Array.isArray(details.comments)) {
      commentCount = details.comments.length;
    }
  } catch {}

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    
    // Normalize both dates to midnight for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate difference in days
    const diffTime = tatDay.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
    } else if (diffDays === 0) {
      return "Due today";
    } else if (diffDays === 1) {
      return "Due tomorrow";
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <Link href={`${basePath}/ticket/${ticket.id}`}>
      <Card className={cn(
        "relative overflow-hidden h-full border transition-all duration-300 cursor-pointer group",
        "hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 hover:-translate-y-1 hover:scale-[1.02] hover:z-10",
        "bg-background hover:bg-accent/30"
      )}>
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-primary/0 transition-all duration-300 pointer-events-none" />
        
        {/* Top accent bar for urgent tickets */}
        {hasTATDue && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-orange-500 to-transparent opacity-60" />
        )}
        
        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 flex-1 min-w-0">
              {/* Header row with ID and badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors duration-300">
                  #{ticket.id}
                </CardTitle>
                {ticket.status && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-semibold border transition-all duration-300",
                      getStatusBadgeClass(ticket.status),
                      "group-hover:scale-105 group-hover:shadow-sm"
                    )}
                  >
                    {ticket.status.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                )}
                {ticket.escalationCount && Number(ticket.escalationCount) > 0 && (
                  <Badge variant="destructive" className="text-xs font-semibold gap-1.5 group-hover:scale-105 transition-transform shadow-sm">
                    <AlertTriangle className="w-3 h-3 group-hover:animate-pulse" />
                    Escalated {ticket.escalationCount}x
                  </Badge>
                )}
              </div>
              
              {/* Category and Subcategory */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-medium border-muted-foreground/30 group-hover:border-primary/40 transition-colors bg-muted/50">
                  {ticket.category}
                </Badge>
                {ticket.subcategory && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                    <FileText className="w-3 h-3 group-hover:text-primary transition-colors" />
                    <span className="font-medium truncate max-w-[200px]">{ticket.subcategory}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4 relative z-10">
          {/* Description */}
          <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors duration-300">
            {ticket.description || "No description provided"}
          </p>
          
          {/* Metadata section */}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-border/50 group-hover:border-primary/30 transition-colors duration-300">
            {/* First row: User and Location */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground/90 transition-colors duration-300">
                <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                  <User className="w-3 h-3 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="font-semibold">{ticket.userNumber}</span>
              </div>
              {ticket.location && (
                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground/90 transition-colors duration-300">
                  <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <MapPin className="w-3 h-3 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <span className="font-medium truncate max-w-[120px]">{ticket.location}</span>
                </div>
              )}
            </div>
            
            {/* Second row: Date and TAT */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground/90 transition-colors duration-300">
                <div className="p-1 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                  <Calendar className="w-3 h-3 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="font-medium">
                  {ticket.createdAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {tatDate && (
                <div className={cn(
                  "flex items-center gap-1.5 font-semibold transition-all duration-300 px-2 py-1 rounded-md",
                  hasTATDue 
                    ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30" 
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30",
                  "group-hover:scale-105"
                )}>
                  <Clock className={cn(
                    "w-3.5 h-3.5 transition-transform duration-300",
                    hasTATDue && "group-hover:animate-pulse"
                  )} />
                  <span className="text-xs whitespace-nowrap">{formatDate(tatDate)}</span>
                </div>
              )}
            </div>
            
            {/* Third row: Comments count if available */}
            {commentCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                <FileText className="w-3 h-3" />
                <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
