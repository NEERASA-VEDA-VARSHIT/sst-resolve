import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, User, MapPin, FileText, Clock, AlertTriangle, Image as ImageIcon, MessageSquare } from "lucide-react";
import { db, tickets, categories, users, ticket_statuses, roles } from "@/db";
import { eq, aliasedTable } from "drizzle-orm";
import { AdminActions } from "@/components/tickets/AdminActions";
import { CommitteeTagging } from "@/components/admin/CommitteeTagging";
import { SlackThreadView } from "@/components/tickets/SlackThreadView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { normalizeStatusForComparison, formatStatus } from "@/lib/utils";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { slackConfig } from "@/conf/config";

// Force dynamic rendering for real-time ticket data
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  if (role !== "admin" && role !== "super_admin") redirect("/student/dashboard");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const assignedUser = aliasedTable(users, "assigned_user");

  // Fetch ticket with joins for category, creator, and assigned staff
  const ticketRows = await db
    .select({
      id: tickets.id,
      status: ticket_statuses.value,
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
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      resolved_at: tickets.resolved_at,
      category_name: categories.name,
      creator_first_name: users.first_name,
      creator_last_name: users.last_name,
      creator_email: users.email,
      assigned_staff_id: assignedUser.id,
      slack_thread_id: tickets.slack_thread_id,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .leftJoin(assignedUser, eq(tickets.assigned_to, assignedUser.id))
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(eq(tickets.id, id))
    .limit(1);

  if (ticketRows.length === 0) notFound();
  const ticket = {
    ...ticketRows[0],
    creator_name: [ticketRows[0].creator_first_name, ticketRows[0].creator_last_name].filter(Boolean).join(' ').trim() || null,
    status: ticketRows[0].status ? {
      value: ticketRows[0].status,
      label: ticketRows[0].status_label || ticketRows[0].status,
      badge_color: ticketRows[0].status_badge_color,
    } : null,
  };

  // Parse metadata (JSONB) with error handling
  let metadata: any = {};
  let subcategory: string | null = null;
  let comments: any[] = [];

  try {
    metadata = (ticket.metadata as any) || {};
    subcategory = metadata?.subcategory || null;
    comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
  } catch (error) {
    console.error('[Admin Ticket] Error parsing metadata:', error);
    // Continue with empty defaults
  }

  // Normalize status for comparisons
  const statusValueStr = typeof ticket.status === 'string' 
    ? ticket.status 
    : (ticket.status && typeof ticket.status === 'object' && 'value' in ticket.status ? ticket.status.value : null);
  const normalizedStatus = normalizeStatusForComparison(statusValueStr);

  const getStatusBadgeClass = (status: string | null | undefined) => {
    const normalized = normalizeStatusForComparison(status);
    if (!normalized) return "bg-muted text-foreground";
    switch (normalized) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent";
      case "reopened":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-transparent";
      case "in_progress":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-transparent";
      case "awaiting_student_response":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-transparent";
      case "resolved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-transparent";
      case "closed":
        return "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent";
      default:
        return "bg-muted text-foreground";
    }
  };

  // Check for TAT
  const tatDate = ticket.due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
  const hasTATDue = tatDate && tatDate.getTime() < new Date().getTime();
  const isTATToday = tatDate && tatDate.toDateString() === new Date().toDateString();

  const forwardTargetsRaw = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
    })
    .from(users)
    .leftJoin(roles, eq(users.role_id, roles.id))
    .where(eq(roles.name, "super_admin"));

  const forwardTargets = forwardTargetsRaw
    .filter((admin) => !!admin.id)
    .map((admin) => ({
      id: admin.id!,
      name: [admin.first_name, admin.last_name].filter(Boolean).join(" ").trim() || admin.email || "Super Admin",
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
                    Target resolution date: {tatDate.toLocaleDateString()}
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
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-base leading-relaxed">
                {ticket.description || "No description provided"}
              </p>

              {/* Display Images if available */}
              {metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">Attached Images</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {metadata.images
                      .filter((imageUrl: any): imageUrl is string => typeof imageUrl === 'string' && imageUrl.trim().length > 0)
                      .map((imageUrl: string, index: number) => (
                        <a
                          key={index}
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                        >
                          <img
                            src={imageUrl}
                            alt={`Ticket image ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </a>
                      ))}
                  </div>
                </div>
              )}
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
            <CardContent className="space-y-4">
              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment: any, idx: number) => {
                    if (!comment || typeof comment !== 'object') return null;
                    const isInternal = comment.isInternal || comment.type === "internal_note" || comment.type === "super_admin_note";
                    const commentText = comment.text || comment.message || '';
                    const commentAuthor = comment.author || comment.created_by || 'Unknown';
                    let commentDate: Date | null = null;

                    try {
                      if (comment.createdAt) {
                        commentDate = new Date(comment.createdAt);
                        if (isNaN(commentDate.getTime())) commentDate = null;
                      }
                    } catch {
                      commentDate = null;
                    }

                    return (
                      <Card key={idx} className={`border ${isInternal ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : 'bg-muted/30'}`}>
                        <CardContent className="p-4">
                          {isInternal && (
                            <Badge variant="outline" className="mb-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                              Internal Note
                            </Badge>
                          )}
                          <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                            {commentText}
                          </p>
                          <Separator className="my-2" />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {commentAuthor && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="font-medium">{commentAuthor}</span>
                              </div>
                            )}
                            {commentDate && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{commentDate.toLocaleString()}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No comments yet</p>
                </div>
              )}
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

          {/* Slack Thread */}
          {ticket.slack_thread_id && (
            <SlackThreadView
              threadId={ticket.slack_thread_id}
              channel={(slackConfig.channels.hostel as string) || "#tickets-hostel"}
            />
          )}
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
                  {ticket.created_at?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              {tatDate && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4" />
                      TAT Due Date
                    </label>
                    <p className="text-base font-medium">{tatDate.toLocaleDateString()}</p>
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
        </div>
      </div>
    </div>
  );
}
