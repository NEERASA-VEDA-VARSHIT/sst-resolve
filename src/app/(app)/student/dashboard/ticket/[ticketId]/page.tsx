import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ArrowLeft, Clock, CheckCircle2, AlertCircle, MessageSquare, User, FileText, UserCheck, TrendingUp, CalendarCheck, MapPin, Image as ImageIcon, Info, RotateCw, AlertTriangle } from "lucide-react";
import { CommentForm } from "@/components/tickets/CommentForm";
import { RatingForm } from "@/components/tickets/RatingForm";
import { StudentActions } from "@/components/tickets/StudentActions";
import { ImageLightbox } from "@/components/tickets/ImageLightbox";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { DynamicFieldDisplay } from "@/components/tickets/DynamicFieldDisplay";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getFullTicketData } from "@/lib/ticket/getFullTicketData";
import { resolveProfileFields } from "@/lib/ticket/profileFieldResolver";
import { buildTimeline } from "@/lib/ticket/buildTimeline";
import { normalizeStatusForComparison } from "@/lib/utils";
import { getTicketStatuses, buildProgressMap } from "@/lib/status/getTicketStatuses";
import { format } from "date-fns";

// Force dynamic rendering for real-time ticket data
export const dynamic = "force-dynamic";

// Revalidate cached response every 30 seconds
// Ticket updates are rare, so this provides a performance boost
export const revalidate = 30;

// Icon map for timeline
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  MessageSquare,
  AlertTriangle,
};

export default async function StudentTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  // Get user_id from database
  const dbUser = await getOrCreateUser(userId);

  if (!dbUser) {
    console.error('[Student Ticket Page] Failed to create/fetch user');
    notFound();
  }

  // Fetch ALL ticket data in ONE optimized call (5-7 DB queries total)
  const [data, ticketStatuses] = await Promise.all([
    getFullTicketData(id, dbUser.id),
    getTicketStatuses(),
  ]);

  if (!data) {
    // getFullTicketData returns null if ticket doesn't exist or user doesn't own it
    // This prevents students from viewing other students' tickets
    notFound();
  }

  // Additional security check: Ensure ticket belongs to this student
  // (getFullTicketData already checks this, but defense-in-depth)
  if (data.ticket.created_by !== dbUser.id) {
    redirect("/student/dashboard");
  }

  // Explicitly type subSubcategory to avoid unknown inference
  interface SubSubcategory {
    id: number;
    name: string;
    slug: string;
  }

  interface RawSubSubcategory {
    id?: unknown;
    name?: unknown;
    slug?: unknown;
  }

  // Explicitly type the entire destructuring to prevent unknown inference
  /* eslint-disable @typescript-eslint/no-explicit-any */
  interface TicketData {
    ticket: any;
    category: any;
    subcategory: any;
    subSubcategory: RawSubSubcategory | null;
    creator: any;
    student: any;
    assignedStaff: any;
    profileFields: any[];
    dynamicFields: any[];
    comments: any[];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const {
    ticket,
    category,
    subcategory,
    subSubcategory: rawSubSubcategory,
    creator,
    student,
    assignedStaff,
    profileFields,
    dynamicFields,
    comments,
  } = data as TicketData;
  
  // Explicitly type only subSubcategory to fix type inference
  const typedRawSubSubcategory: RawSubSubcategory | null = rawSubSubcategory as RawSubSubcategory | null;

  const subSubcategory: SubSubcategory | null = (
    typedRawSubSubcategory &&
    typeof typedRawSubSubcategory.id === "number" &&
    typeof typedRawSubSubcategory.name === "string" &&
    typeof typedRawSubSubcategory.slug === "string"
      ? {
          id: typedRawSubSubcategory.id,
          name: typedRawSubSubcategory.name,
          slug: typedRawSubSubcategory.slug,
        }
      : null
  ) as SubSubcategory | null;


  const metadata = (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata))
    ? (ticket.metadata as Record<string, unknown>)
    : {};
  
  // Extract TAT-related values with proper typing
  const tatSetAt = metadata.tatSetAt ? (typeof metadata.tatSetAt === 'string' ? metadata.tatSetAt : metadata.tatSetAt instanceof Date ? metadata.tatSetAt.toISOString() : null) : null;
  const tatSetBy = metadata.tatSetBy ? (typeof metadata.tatSetBy === 'string' ? metadata.tatSetBy : null) : null;
  const tat = metadata.tat ? (typeof metadata.tat === 'string' ? metadata.tat : null) : null;
  const tatDate = metadata.tatDate ? (typeof metadata.tatDate === 'string' ? metadata.tatDate : null) : null;
  const tatExtensions = Array.isArray(metadata.tatExtensions) ? metadata.tatExtensions as Array<Record<string, unknown>> : [];


  // Resolve profile field values
  const resolvedProfileFields = resolveProfileFields(
    profileFields,
    metadata,
    student,
    creator
  );

  // Build progress map from statuses
  const progressMap = buildProgressMap(ticketStatuses);

  // Calculate ticket progress
  // ticket.status is now an object with { value, label, badge_color } or null
  const statusValue = ticket.status?.value || null;
  const normalizedStatus = normalizeStatusForComparison(statusValue);
  const ticketProgress = progressMap[normalizedStatus] || 0;

  // Build timeline using factory function
  // buildTimeline expects status as string value, not object - use normalizedStatus
  const timelineEntries = buildTimeline(ticket, normalizedStatus);
  
  // Add TAT set entry if TAT was set
  if (tatSetAt) {
    const tatSetDate = new Date(tatSetAt);
    if (!isNaN(tatSetDate.getTime())) {
      timelineEntries.push({
        title: "TAT Set",
        icon: "Clock",
        date: tatSetDate,
        color: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-600 dark:text-amber-400",
      });
    }
  }
  
  // Add Overdue entry if TAT date has passed and ticket is not resolved
  if (tatDate) {
    const tatDateObj = new Date(tatDate);
    const now = new Date();
    const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed" || ticketProgress === 100;
    
    // Check if TAT date has passed
    if (!isNaN(tatDateObj.getTime()) && tatDateObj.getTime() < now.getTime() && !isResolved) {
      // Add overdue entry at the TAT date (when it became overdue)
      timelineEntries.push({
        title: "Overdue",
        icon: "AlertTriangle",
        date: tatDateObj,
        color: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-600 dark:text-red-400",
      });
    }
  }
  
  // Sort timeline by date
  timelineEntries.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return a.date.getTime() - b.date.getTime();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4">
          <Link href="/student/dashboard">
            <Button variant="ghost" className="gap-2 hover:bg-accent/50 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Tickets</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>

        {/* Main Ticket Card - Enhanced Header */}
        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-4 p-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Ticket #{ticket.id}
                  </CardTitle>
                </div>

                {/* Status and Category Badges - Enhanced */}
                <div className="flex items-center gap-2 flex-wrap">
                  <TicketStatusBadge status={ticket.status} />
                  {category && (
                    <Badge variant="secondary" className="font-medium">
                      {category.name}
                    </Badge>
                  )}
                  {subcategory && (
                    <Badge variant="outline" className="font-medium">
                      {subcategory.name}
                    </Badge>
                  )}
                  {subSubcategory && (
                    <Badge variant="outline" className="font-medium text-xs">
                      {subSubcategory.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Quick Info Grid - Progress, Assignment, SLA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Progress Card */}
            <Card className="border-2 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-muted-foreground">Progress</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{ticketProgress}%</span>
                </div>
                <div className="relative">
                  <Progress 
                    value={ticketProgress} 
                    className={`h-2.5 rounded-full shadow-inner ${
                      normalizedStatus === "in_progress" 
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:via-blue-600 [&>div]:to-blue-500 [&>div]:shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
                        : normalizedStatus === "resolved" || normalizedStatus === "closed"
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-emerald-600 [&>div]:to-emerald-500 [&>div]:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : normalizedStatus === "reopened"
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:via-indigo-600 [&>div]:to-indigo-500 [&>div]:shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                        : normalizedStatus === "awaiting_student_response"
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:via-amber-600 [&>div]:to-amber-500 [&>div]:shadow-[0_0_8px_rgba(217,119,6,0.4)]"
                        : "[&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:via-primary/90 [&>div]:to-primary [&>div]:shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                    }`} 
                  />
                  {/* Animated shimmer effect for active progress */}
                  {ticketProgress > 0 && ticketProgress < 100 && (
                    <div 
                      className="absolute top-0 left-0 h-2.5 rounded-full pointer-events-none overflow-hidden"
                      style={{ width: `${ticketProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Assignment Card */}
            <Card className="border-2 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-muted-foreground">Assigned To</span>
                </div>
                <p className="text-base font-semibold break-words">
                  {assignedStaff ? assignedStaff.name : <span className="text-muted-foreground">Not assigned</span>}
                </p>
              </CardContent>
            </Card>

            {/* SLA Card - Dynamic based on TAT */}
            {(() => {
              // If ticket is resolved/closed, show resolved status instead of TAT
              const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed" || ticketProgress === 100;
              
              // If ticket is reopened, show different message
              const isReopened = normalizedStatus === "reopened" || normalizedStatus.includes("reopened");
              
              if (isResolved) {
                return (
                  <Card className="border-2 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                      </div>
                      <p className="text-sm font-semibold break-words text-emerald-700 dark:text-emerald-400">
                        Resolved
                      </p>
                      {ticket.resolved_at && (
                        <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs text-muted-foreground">
                            Resolved on {format(new Date(ticket.resolved_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              
              if (isReopened) {
                return (
                  <Card className="border-2 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                      </div>
                      <p className="text-sm font-semibold break-words text-indigo-700 dark:text-indigo-400">
                        Reopened
                      </p>
                      {(ticket.reopened_at || ticket.updated_at) && (
                        <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                          <p className="text-xs text-muted-foreground">
                            Reopened on {format(new Date(ticket.reopened_at || ticket.updated_at || new Date()), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            New TAT will be set by admin
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              
              // Calculate expected resolution time for active tickets
              // Priority: metadata.tatDate > resolution_due_at > metadata.tat (calculate) > default 48 hours
              let expectedResolution: string | null = null;
              let isOverdue = false;
              
              if (tatDate) {
                // Use TAT date if set
                const tatDateObj = new Date(tatDate);
                if (!isNaN(tatDateObj.getTime())) {
                  const now = new Date();
                  const diffMs = tatDateObj.getTime() - now.getTime();
                  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                  if (diffHours > 0) {
                    expectedResolution = diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? 's' : ''}` : `${Math.ceil(diffHours / 24)} day${Math.ceil(diffHours / 24) !== 1 ? 's' : ''}`;
                  } else {
                    expectedResolution = "Overdue";
                    isOverdue = true;
                  }
                }
              } else if (ticket.resolution_due_at) {
                // Use resolution_due_at if available
                const dueDate = new Date(ticket.resolution_due_at);
                if (!isNaN(dueDate.getTime())) {
                  const now = new Date();
                  const diffMs = dueDate.getTime() - now.getTime();
                  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                  if (diffHours > 0) {
                    expectedResolution = diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? 's' : ''}` : `${Math.ceil(diffHours / 24)} day${Math.ceil(diffHours / 24) !== 1 ? 's' : ''}`;
                  } else {
                    expectedResolution = "Overdue";
                    isOverdue = true;
                  }
                }
              } else if (tat) {
                // Calculate from TAT text
                expectedResolution = tat;
              } else {
                // Default to 48 hours
                expectedResolution = "48 hours";
              }
              
              if (!expectedResolution) return null;
              
              return (
                <Card className={`border-2 ${isOverdue ? 'bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10' : 'bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                      <span className="text-sm font-medium text-muted-foreground">Expected Resolution</span>
                    </div>
                    <p className={`text-sm font-semibold break-words ${isOverdue ? 'text-red-700 dark:text-red-400' : ''}`}>
                      {expectedResolution}
                    </p>
                    {tatSetAt && tatSetBy && !isResolved && !isReopened && (
                      <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                        <p className="text-xs text-muted-foreground">
                          Set by {tatSetBy} on {format(new Date(tatSetAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Submitted Information - Enhanced Design */}
          <Card className="border-2 shadow-md">
            <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                Submitted Information
              </CardTitle>
              <CardDescription>
                Details you provided when creating this ticket
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Description - Prominent */}
              {ticket.description && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                  </div>
                  <p className="text-base whitespace-pre-wrap leading-relaxed break-words font-medium">{ticket.description}</p>
                </div>
              )}

              {/* Location */}
              {ticket.location && (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</p>
                  </div>
                  <p className="text-sm font-semibold break-words">{ticket.location}</p>
                </div>
              )}

              {/* Attachments - Enhanced */}
              {metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments ({metadata.images.length})</p>
                  </div>
                  <ImageLightbox images={metadata.images} />
                </div>
              )}

              {/* Additional Dynamic Fields - Filter out TAT-related fields */}
              {(() => {
                // Filter out TAT-related fields from dynamic fields
                const filteredFields = dynamicFields.filter((field) => {
                  const keyLower = field.key.toLowerCase();
                  const labelLower = field.label.toLowerCase();
                  // Exclude TAT-related fields
                  return !keyLower.includes('tat') && 
                         !labelLower.includes('tat') &&
                         !keyLower.includes('tat_set') &&
                         !labelLower.includes('tat set') &&
                         !keyLower.includes('tat_extensions') &&
                         !labelLower.includes('tat extensions');
                });
                
                return filteredFields.length > 0 ? (
                  <div className="space-y-3">
                    {filteredFields.map((field) => (
                      <DynamicFieldDisplay key={field.key} field={field} />
                    ))}
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* Timeline - Enhanced with connecting lines */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                </div>
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Connecting line */}
                {timelineEntries.length > 1 && (
                  <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                )}
                <div className="space-y-4 relative">
                  {timelineEntries.map((entry: Record<string, unknown>, index: number) => {
                    const iconKey = typeof entry.icon === 'string' ? entry.icon : '';
                    const IconComponent = ICON_MAP[iconKey] ?? AlertCircle;
                    const title = typeof entry.title === 'string' ? entry.title : '';
                    const entryDate = entry.date && (typeof entry.date === 'string' || entry.date instanceof Date) ? entry.date : null;
                    return (
                      <div key={index} className="flex items-start gap-4 relative">
                        {/* Icon with background */}
                        <div className={`relative z-10 p-2.5 rounded-full flex-shrink-0 border-2 bg-background ${typeof entry.color === 'string' ? entry.color : 'bg-muted'}`}>
                          <IconComponent className={`w-4 h-4 ${typeof entry.textColor === 'string' ? entry.textColor : 'text-foreground'}`} />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="p-3 rounded-lg bg-muted/50 border">
                            <p className="text-sm font-semibold mb-1.5 break-words">{title}</p>
                            {entryDate && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{format(entryDate, 'MMM d, yyyy')}</span>
                                <span>•</span>
                                <span>{format(entryDate, 'h:mm a')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments / Conversation - Enhanced Chat-like Design */}
          <Card className="border-2 shadow-md">
            <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                Conversation
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {comments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {comments.length > 0 ? (
                <ScrollArea className="max-h-[500px] pr-4">
                  <div className="space-y-4">
                    {comments.map((comment: Record<string, unknown>, idx: number) => {
                      const commentText = typeof comment.text === 'string' ? comment.text : '';
                      const commentAuthor = typeof comment.author === 'string' ? comment.author : null;
                      // Check both createdAt (camelCase) and created_at (snake_case) for timestamp
                      const rawTimestamp = comment.createdAt || comment.created_at;
                      const commentCreatedAt = rawTimestamp && 
                        (typeof rawTimestamp === 'string' || rawTimestamp instanceof Date) 
                        ? rawTimestamp : null;
                      const commentSource = typeof comment.source === 'string' ? comment.source : null;
                      // Student comments have source === "website", admin comments have source === "admin_dashboard" or null
                      const isStudent = commentSource === "website";
                      const isAdmin = !isStudent;
                      
                      return (
                        <div key={idx} className={`flex gap-3 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          {/* Student comments align left, Admin comments align right */}
                          <div className={`flex gap-3 max-w-[80%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              <User className="w-4 h-4" />
                            </div>
                            {/* Message bubble */}
                            <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                              <div className={`rounded-2xl px-4 py-3 ${isAdmin ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted border rounded-tl-sm'}`}>
                                <p className={`text-sm whitespace-pre-wrap leading-relaxed break-words ${isAdmin ? 'text-primary-foreground' : ''}`}>{commentText}</p>
                              </div>
                              <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-1 px-1 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                {commentCreatedAt ? (
                                  <>
                                    <span className="font-medium">{format(new Date(commentCreatedAt), 'MMM d, yyyy')}</span>
                                    <span>•</span>
                                    <span className="font-medium">{format(new Date(commentCreatedAt), 'h:mm a')}</span>
                                    {commentAuthor && (
                                      <>
                                        <span>•</span>
                                        <span className="font-medium">{commentAuthor}</span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  commentAuthor && (
                                    <span className="font-medium">{commentAuthor}</span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="text-sm font-medium mb-1">No comments yet</p>
                  <p className="text-xs">Updates and responses will appear here</p>
                </div>
              )}

              {/* Comment Form - Enhanced */}
              {normalizedStatus === "awaiting_student_response" && (
                <div className="pt-6 mt-6 border-t">
                  {comments.length > 0 && comments[comments.length - 1]?.source !== "website" && (
                    <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm">
                        <span className="font-medium text-amber-900 dark:text-amber-100">
                          Admin has asked a question. Please respond below.
                        </span>
                      </AlertDescription>
                    </Alert>
                  )}
                  <CommentForm 
                    ticketId={ticket.id} 
                    currentStatus={statusValue || undefined}
                    comments={comments}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating after closed/resolved - Enhanced */}
          {(normalizedStatus === "closed" || normalizedStatus === "resolved") && (
            <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Rate Your Experience</CardTitle>
                    <CardDescription>
                      Help us improve by rating your ticket resolution experience
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <RatingForm ticketId={ticket.id} currentRating={ticket.rating ? ticket.rating.toString() : undefined} />
              </CardContent>
            </Card>
          )}

          {/* Actions Available to Student */}
          <StudentActions
            ticketId={ticket.id}
            currentStatus={statusValue || "open"}
          />

          {/* Additional Attachments (if different from metadata.images) */}
          {ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <ImageIcon className="w-4 h-4 text-primary" />
                  </div>
                  Additional Attachments ({ticket.attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ticket.attachments.map((attachment: { url: string }, index: number) => (
                    <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border-2 hover:border-primary transition-colors cursor-pointer">
                      <Image
                        src={attachment.url}
                        alt={`Attachment ${index + 1}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        onClick={() => window.open(attachment.url, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium px-2 text-center transition-opacity">
                          View Full Size
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAT Information */}
          {(tatSetAt || tatSetBy || tat) && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  TAT Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tatSetAt && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Set At</p>
                      <p className="text-sm font-semibold break-words">
                        {format(new Date(tatSetAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  )}
                  {tatSetBy && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Set By</p>
                      <p className="text-sm font-semibold break-words">
                        {tatSetBy}
                      </p>
                    </div>
                  )}
                  {tat && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Duration</p>
                      <p className="text-sm font-semibold break-words">
                        {tat}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAT Extensions - Only show if extensions exist */}
          {tatExtensions.length > 0 && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  TAT Extensions ({tatExtensions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tatExtensions.map((extension: Record<string, unknown>, index: number) => {
                    const extendedAt = extension.extendedAt ? (typeof extension.extendedAt === 'string' ? extension.extendedAt : extension.extendedAt instanceof Date ? extension.extendedAt.toISOString() : null) : null;
                    const previousTAT = extension.previousTAT ? String(extension.previousTAT) : null;
                    const newTAT = extension.newTAT ? String(extension.newTAT) : null;
                    return (
                      <div key={index} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extension #{index + 1}</p>
                          {extendedAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(extendedAt), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {previousTAT && (
                            <div>
                              <span className="text-muted-foreground">Previous: </span>
                              <span className="font-medium">{previousTAT}</span>
                            </div>
                          )}
                          {newTAT && (
                            <div>
                              <span className="text-muted-foreground">New: </span>
                              <span className="font-medium">{newTAT}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Information - Collapsible/Minimal */}
          {(ticket.escalation_level ?? 0) > 0 && (
            <Card className="border-2 bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Escalation Level</span>
                  <Badge variant="outline" className="font-semibold">{ticket.escalation_level}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Information - Moved to bottom */}
          {resolvedProfileFields.length > 0 && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resolvedProfileFields.map((field) => (
                    <div key={field.field_name} className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        {field.label}
                      </p>
                      <p className="text-sm font-semibold break-words">{field.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </CardContent>
      </Card>
      </div>
    </div>
  );
}
