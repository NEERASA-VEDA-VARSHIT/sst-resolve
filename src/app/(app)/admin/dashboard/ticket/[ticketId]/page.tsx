import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, User, MapPin, FileText, Clock, AlertTriangle, AlertCircle, Image as ImageIcon, MessageSquare, CheckCircle2, Sparkles, RotateCw } from "lucide-react";
import { db, categories, users, roles, students, hostels, tickets, ticket_statuses, domains } from "@/db";
import { eq, sql } from "drizzle-orm";
import type { TicketMetadata } from "@/db/inferred-types";
import { AdminActions } from "@/components/tickets/AdminActions";
import { CommitteeTagging } from "@/components/admin/CommitteeTagging";
import { AdminCommentComposer } from "@/components/tickets/AdminCommentComposer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { slackConfig } from "@/conf/config";
import { ticketMatchesAdminAssignment } from "@/lib/assignment/admin-assignment";
import { getCachedAdminUser, getCachedAdminAssignment } from "@/lib/cache/cached-queries";
import { buildTimeline } from "@/lib/ticket/buildTimeline";
import { normalizeStatusForComparison } from "@/lib/utils";
import { getTicketStatuses, buildProgressMap } from "@/lib/status/getTicketStatuses";
import { getTicketStatusByValue } from "@/lib/status/getTicketStatuses";
import { getCategoryProfileFields, getCategorySchema } from "@/lib/category/categories";
import { resolveProfileFields } from "@/lib/ticket/profileFieldResolver";
import { extractDynamicFields } from "@/lib/ticket/formatDynamicFields";
import { DynamicFieldDisplay } from "@/components/tickets/DynamicFieldDisplay";
import { CardDescription } from "@/components/ui/card";
import { Info } from "lucide-react";
import { format } from "date-fns";

// Revalidate every 10 seconds for ticket detail page (more frequent for real-time updates)
export const revalidate = 10;

export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const [{ dbUser: dbUserResult, role }, ticketRowsResult, forwardTargetsResult] = await Promise.all([
    // Use cached function for user and role (request-scoped deduplication)
    getCachedAdminUser(userId),
    // Fetch ticket with joins using Drizzle ORM
    db
      .select({
        id: tickets.id,
        status_value: ticket_statuses.value,
        status_label: ticket_statuses.label,
        status_badge_color: ticket_statuses.badge_color,
        description: tickets.description,
        location: tickets.location,
        created_by: tickets.created_by,
        category_id: tickets.category_id,
        assigned_to: tickets.assigned_to,
        escalation_level: tickets.escalation_level,
        metadata: tickets.metadata,
        due_at: tickets.resolution_due_at,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        category_name: categories.name,
        category_domain_name: domains.name,
        creator_full_name: users.full_name,
        creator_email: users.email,
        assigned_staff_id: tickets.assigned_to,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(domains, eq(categories.domain_id, domains.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, id))
      .limit(1),
    
    // Fetch forward targets (super admins) - only needed for AdminActions
    db
      .select({
        id: users.id,
        full_name: users.full_name,
        email: users.email,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .where(eq(roles.name, "super_admin")),
  ]);

  type TicketRow = {
    id: number;
    status_value: string | null;
    status_label: string | null;
    status_badge_color: string | null;
    description: string | null;
    location: string | null;
    created_by: string;
    category_id: number | null;
    assigned_to: string | null;
    assigned_staff_id: string | null;
    escalation_level: number | null;
    metadata: unknown;
    due_at: Date | null;
    acknowledgement_due_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
    category_name: string | null;
    category_domain_name: string | null;
    creator_full_name: string | null;
    creator_email: string | null;
  };

  const ticketRows = ticketRowsResult;
  const dbUser = dbUserResult;

  if (ticketRows.length === 0) notFound();
  if (!dbUser) redirect("/");

  // Fetch student data, profile fields, and category schema after we have ticket data
  const [studentDataResult, profileFieldsConfig, categorySchema] = await Promise.all([
    // Fetch student data for profile fields
    db
      .select({
        student_hostel_id: students.hostel_id,
        student_hostel_name: hostels.name,
        student_room_no: students.room_no,
      })
      .from(students)
      .leftJoin(hostels, eq(hostels.id, students.hostel_id))
      .where(eq(students.user_id, ticketRows[0].created_by!))
      .limit(1),
    
    // Fetch profile fields configuration
    ticketRows[0].category_id
      ? getCategoryProfileFields(ticketRows[0].category_id)
      : Promise.resolve([]),
    
    // Fetch category schema for dynamic fields
    ticketRows[0].category_id
      ? getCategorySchema(ticketRows[0].category_id)
      : Promise.resolve(null),
  ]);
  
  // Role check
  if (role !== "admin" && role !== "super_admin") redirect("/student/dashboard");
  
  // Security check: Ensure admin has access to this ticket (if not super_admin)
  // Super admins can always access any ticket
  if (role === "admin") {
    const ticketRow = ticketRows[0];
    const isAssigned = ticketRow.assigned_to === dbUser.id;
    
    if (!isAssigned) {
      try {
        const adminAssignment = await getCachedAdminAssignment(userId);
        
        // Priority 1: Check if admin is assigned to this category (via category_assignments or default_admin_id)
        // This matches the dashboard filtering logic
        const { getAdminAssignedCategoryDomains } = await import("@/lib/assignment/admin-assignment");
        const assignedCategoryDomains = await getAdminAssignedCategoryDomains(dbUser.id);
        const ticketDomain = ticketRow.category_domain_name || null;
        
        if (ticketDomain && assignedCategoryDomains.includes(ticketDomain)) {
          // Admin is assigned to this category's domain - allow access
          // If admin has a scope, we still allow access (scope filtering is for dashboard listing, not individual ticket access)
        } else {
          // Priority 2: Check domain/scope access (from primary assignment)
          // Handle "Global" as a special case - admins with Global domain can access all tickets
          const assignmentDomain = (adminAssignment.domain || "").toLowerCase();
          const ticketDomainLower = (ticketRow.category_domain_name || "").toLowerCase();
          
          if (assignmentDomain === "global" || !adminAssignment.domain) {
            // Admin with Global domain or no assignment can access all tickets
            // Allow access
          } else {
            // Use category_domain_name (from domains table) instead of category_name
            // This correctly matches the admin's domain assignment
            const hasAccess = ticketMatchesAdminAssignment(
              { category: ticketRow.category_domain_name || null, location: ticketRow.location || null },
              adminAssignment
            );
            
            if (!hasAccess) {
              // Log for debugging
              console.warn('[Admin Ticket Page] Access denied:', {
                ticketId: id,
                categoryDomain: ticketRow.category_domain_name,
                location: ticketRow.location,
                adminAssignment,
                assignedCategoryDomains,
                isAssigned,
              });
              redirect("/admin/dashboard"); // Redirect to dashboard if no access
            }
          }
        }
      } catch (error) {
        console.error('[Admin Ticket Page] Error checking access:', error);
        // On error, allow access to prevent blocking legitimate access
        // The page will still render, and if there's a real issue, it will be caught elsewhere
      }
    }
  }
  
  // Build status display from DB data
  const statusValue = ticketRows[0].status_value;
  const statusDisplay = statusValue
    ? {
        value: statusValue,
        label: ticketRows[0].status_label || statusValue,
        badge_color: ticketRows[0].status_badge_color || "default",
      }
    : null;

  const ticket = {
    ...ticketRows[0],
    creator_name: ticketRows[0].creator_full_name || null,
    status: statusDisplay,
    slack_thread_id: null,
  };

  // Parse metadata (JSONB) with error handling
  type TicketMetadataWithExtras = TicketMetadata & {
    subcategory?: string;
    comments?: Array<Record<string, unknown>>;
    images?: string[];
  };
  let metadata: TicketMetadataWithExtras = {};
  let subcategory: string | null = null;
  let comments: Array<Record<string, unknown>> = [];

  try {
    metadata = (ticket.metadata as TicketMetadataWithExtras) || {};
    subcategory = metadata?.subcategory || null;
    comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
  } catch (error) {
    console.error('[Admin Ticket] Error parsing metadata:', error);
    // Continue with empty defaults
  }

  // Extract dynamic fields from metadata (after metadata is initialized)
  const dynamicFields = extractDynamicFields(metadata as Record<string, unknown>, categorySchema || {});

  // Normalize status for comparisons
  const statusValueStr = typeof ticket.status === 'string' 
    ? ticket.status 
    : (ticket.status && typeof ticket.status === 'object' && 'value' in ticket.status ? ticket.status.value : null);
  const normalizedStatus = normalizeStatusForComparison(statusValueStr);

  // Get ticket statuses and build progress map
  const ticketStatuses = await getTicketStatuses().catch(() => []);
  const progressMap = Array.isArray(ticketStatuses) && ticketStatuses.length > 0 
    ? buildProgressMap(ticketStatuses) 
    : {};
  const ticketProgress = (progressMap && typeof progressMap === 'object' && normalizedStatus && progressMap[normalizedStatus]) 
    ? progressMap[normalizedStatus] 
    : 0;

  // Extract metadata fields for timeline
  let ticketMetadata: TicketMetadata = {};
  if (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata)) {
    ticketMetadata = ticket.metadata as TicketMetadata;
  }
  const resolvedAt = ticketMetadata.resolved_at ? new Date(ticketMetadata.resolved_at) : null;
  const reopenedAt = ticketMetadata.reopened_at ? new Date(ticketMetadata.reopened_at) : null;
  const acknowledgedAt = ticketMetadata.acknowledged_at ? new Date(ticketMetadata.acknowledged_at) : null;

  // Build timeline
  const timelineEntries = buildTimeline({
    created_at: ticket.created_at,
    acknowledged_at: acknowledgedAt || ticket.acknowledgement_due_at || null,
    resolved_at: resolvedAt,
    reopened_at: reopenedAt,
    updated_at: ticket.updated_at,
    escalation_level: ticket.escalation_level || 0,
    status: statusValueStr,
  }, normalizedStatus);

  // Add TAT set entry if TAT was set
  const tatSetAt = metadata?.tatSetAt;
  if (tatSetAt) {
    const tatSetDate = new Date(tatSetAt);
    if (!isNaN(tatSetDate.getTime())) {
      timelineEntries.push({
        title: `TAT Set by ${metadata.tatSetBy || 'Admin'}`,
        icon: "Sparkles",
        date: tatSetDate,
        color: "bg-yellow-100 dark:bg-yellow-900/30",
        textColor: "text-yellow-600 dark:text-yellow-400",
      });
    }
  }

  // Add TAT Extensions
  if (Array.isArray(metadata?.tatExtensions) && metadata.tatExtensions.length > 0) {
    metadata.tatExtensions.forEach((extension: Record<string, unknown>) => {
      const extendedAt = extension.extendedAt ? new Date(extension.extendedAt as string) : null;
      if (extendedAt && !isNaN(extendedAt.getTime())) {
        timelineEntries.push({
          title: `TAT Extended (to ${extension.newTAT || 'new date'})`,
          icon: "Sparkles",
          date: extendedAt,
          color: "bg-orange-100 dark:bg-orange-900/30",
          textColor: "text-orange-600 dark:text-orange-400",
        });
      }
    });
  }

  // Add Overdue entry if TAT date has passed and ticket is not resolved
  const tatDate = ticket.due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
  const now = new Date();
  const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed" || ticketProgress === 100;

  if (tatDate) {
    const tatDateObj = new Date(tatDate);
    if (!isNaN(tatDateObj.getTime()) && tatDateObj.getTime() < now.getTime() && !isResolved) {
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

  // TAT helpers for UI badges/alerts
  const hasTATDue = tatDate && tatDate.getTime() < now.getTime() && !isResolved;
  const isTATToday = tatDate && tatDate.toDateString() === now.toDateString() && !isResolved;

  // Icon map for timeline
  const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    RotateCw,
    MessageSquare,
    Sparkles,
    AlertTriangle,
  };

  // Resolve profile fields for student information
  const [studentData] = studentDataResult;
  const studentRecord = studentData ? {
    hostel_id: studentData.student_hostel_id,
    hostel_name: studentData.student_hostel_name,
    room_no: studentData.student_room_no,
  } : undefined;

  const userRecord = {
    name: ticket.creator_name,
    email: ticket.creator_email,
  };

  const resolvedProfileFields = resolveProfileFields(
    profileFieldsConfig,
    metadata as Record<string, unknown>,
    studentRecord,
    userRecord
  );

  const forwardTargetsRaw = forwardTargetsResult;

  const forwardTargets = forwardTargetsRaw
    .filter((admin) => !!admin.id)
    .map((admin) => ({
      id: admin.id!,
      name: admin.full_name || admin.email || "Super Admin",
      email: admin.email,
    }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Link href="/admin/dashboard">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tickets
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-3xl font-bold mb-2">Ticket #{ticket.id}</CardTitle>
              {subcategory && (
                <p className="text-muted-foreground">{subcategory}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ticket.status && (
                <TicketStatusBadge 
                  status={ticket.status}
                />
              )}
              {ticket.escalation_level && ticket.escalation_level > 0 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Escalated × {ticket.escalation_level}
                </Badge>
              )}
              <Badge variant="outline" className="text-sm px-3 py-1">{ticket.category_name || "Unknown"}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress and Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-muted-foreground">Progress</span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{ticketProgress}%</span>
            </div>
            <Progress value={ticketProgress} className="h-2" />
          </CardContent>
        </Card>
        <Card className="border-2 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-muted-foreground">Assigned To</span>
            </div>
            <p className="text-base font-semibold break-words">
              {ticket.assigned_staff_id ? "Assigned" : "Unassigned"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-muted-foreground">Expected Resolution</span>
            </div>
            {tatDate ? (
              <p className="text-sm font-semibold break-words">
                {hasTATDue ? (
                  <span className="text-red-600 dark:text-red-400">Overdue</span>
                ) : (
                  format(new Date(tatDate), 'MMM d, yyyy')
                )}
              </p>
            ) : (
              <p className="text-sm font-semibold break-words">Not set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TAT Alert */}
      {(hasTATDue || isTATToday) && (
        <Card className={`border-2 ${hasTATDue ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20' : 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${hasTATDue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div>
                <p className={`font-semibold ${hasTATDue ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {hasTATDue ? 'TAT Overdue' : 'TAT Due Today'}
                </p>
                {tatDate && (
                  <p className="text-sm text-muted-foreground">
                    Target resolution date: {format(new Date(tatDate), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {metadata.images
                      .filter((imageUrl: unknown): imageUrl is string => typeof imageUrl === 'string' && imageUrl.trim().length > 0)
                      .map((imageUrl: string, index: number) => (
                        <a
                          key={`${imageUrl}-${index}`}
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                        >
                          <Image
                            src={imageUrl}
                            alt={`Ticket image ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </a>
                      ))}
                  </div>
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

          {/* Timeline Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {timelineEntries.length > 1 && (
                  <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                )}
                <div className="space-y-4 relative">
                  {timelineEntries.map((entry: Record<string, unknown>, index: number) => {
                    const iconKey = typeof entry.icon === 'string' ? entry.icon : '';
                    const IconComponent = ICON_MAP[iconKey] ?? AlertCircle;
                    const title = typeof entry.title === 'string' ? entry.title : '';
                    const color = typeof entry.color === 'string' ? entry.color : '';
                    const textColor = typeof entry.textColor === 'string' ? entry.textColor : '';
                    const entryDate = entry.date instanceof Date ? entry.date : null;
                    return (
                      <div key={index} className="flex items-start gap-4 relative">
                        <div className={`relative z-10 p-2.5 rounded-full flex-shrink-0 border-2 bg-background ${color}`}>
                          <IconComponent className={`w-4 h-4 ${textColor}`} />
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="p-3 rounded-lg bg-muted/50 border">
                            <p className={`text-sm font-semibold mb-1.5 break-words ${textColor}`}>{title}</p>
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

          {/* Comments Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {comments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {comments.length > 0 ? (
                <ScrollArea className="max-h-[500px] pr-4">
                  <div className="space-y-4">
                    {comments.map((comment: Record<string, unknown>, idx: number) => {
                      if (!comment || typeof comment !== 'object') return null;
                      const isInternal = comment.isInternal || comment.type === "internal_note" || comment.type === "super_admin_note";
                      const commentText = (typeof comment.text === 'string' ? comment.text : typeof comment.message === 'string' ? comment.message : '') || '';
                      const commentAuthor = (typeof comment.author === 'string' ? comment.author : typeof comment.created_by === 'string' ? comment.created_by : 'Unknown') || 'Unknown';
                      const commentSource = typeof comment.source === 'string' ? comment.source : null;
                      const rawTimestamp = comment.createdAt || comment.created_at;
                      const commentCreatedAt = rawTimestamp && 
                        (typeof rawTimestamp === 'string' || rawTimestamp instanceof Date) 
                        ? rawTimestamp : null;
                      
                      // For internal notes, keep card style; for regular comments, use chat style
                      if (isInternal) {
                        return (
                          <Card key={idx} className="border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                            <CardContent className="p-4">
                              <Badge variant="outline" className="mb-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                Internal Note
                              </Badge>
                              <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                                {commentText}
                              </p>
                              <Separator className="my-2" />
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                            </CardContent>
                          </Card>
                        );
                      }

                      // Chat-style for regular comments
                      const isStudent = commentSource === "website";
                      const isAdmin = !isStudent;
                      
                      return (
                        <div key={idx} className={`flex gap-3 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex gap-3 max-w-[80%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              <User className="w-4 h-4" />
                            </div>
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

              <Separator />

              <AdminCommentComposer ticketId={ticket.id} />
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminActions
                ticketId={ticket.id}
                currentStatus={statusValueStr || "open"}
                hasTAT={!!ticket.due_at || !!metadata?.tat}
                isSuperAdmin={role === "super_admin"}
                ticketCategory={ticket.category_name || "General"}
                ticketLocation={ticket.location}
                currentAssignedTo={ticket.assigned_staff_id?.toString() || null}
                forwardTargets={forwardTargets}
              />
            </CardContent>
          </Card>

          {/* Committee Tagging */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Committee Tagging</CardTitle>
            </CardHeader>
            <CardContent>
              <CommitteeTagging ticketId={ticket.id} />
            </CardContent>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                  <User className="w-4 h-4" />
                  Created By
                </label>
                <p className="text-base font-medium">{ticket.creator_name || ticket.creator_email || "Unknown"}</p>
                {ticket.creator_email && (
                  <p className="text-xs text-muted-foreground mt-1">{ticket.creator_email}</p>
                )}
              </div>
              {ticket.location && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4" />
                      Location
                    </label>
                    <p className="text-base font-medium">{ticket.location}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" />
                  Created
                </label>
                <p className="text-base font-medium">
                  {ticket.created_at ? format(new Date(ticket.created_at), 'MMM d, yyyy') : 'N/A'}
                </p>
                {ticket.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(ticket.created_at), 'h:mm a')}
                  </p>
                )}
              </div>
              {tatDate && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4" />
                      Expected Resolution
                    </label>
                    <p className={`text-base font-medium ${hasTATDue ? 'text-red-600 dark:text-red-400' : isTATToday ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {format(new Date(tatDate), 'MMM d, yyyy')}
                    </p>
                    {metadata?.tat && (
                      <p className="text-xs text-muted-foreground mt-1">
                        TAT: {String(metadata.tat)}
                      </p>
                    )}
                    {hasTATDue && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                        Overdue
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Student Information */}
          {resolvedProfileFields.length > 0 && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      </div>
    </div>
  );
}
