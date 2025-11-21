import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ArrowLeft, Clock, CheckCircle2, AlertCircle, MessageSquare, User, FileText, UserCheck, TrendingUp, CalendarCheck } from "lucide-react";
import { CommentForm } from "@/components/tickets/CommentForm";
import { RatingForm } from "@/components/tickets/RatingForm";
import { StudentActions } from "@/components/tickets/StudentActions";
import { ImageLightbox } from "@/components/tickets/ImageLightbox";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { DynamicFieldDisplay } from "@/components/tickets/DynamicFieldDisplay";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOrCreateUser } from "@/lib/user-sync";
import { getFullTicketData } from "@/lib/ticket/getFullTicketData";
import { resolveProfileFields } from "@/lib/ticket/profileFieldResolver";
import { buildTimeline } from "@/lib/ticket/buildTimeline";
import { normalizeStatusForComparison } from "@/lib/utils";
import { getTicketStatuses, buildProgressMap } from "@/lib/status/getTicketStatuses";
import { format } from "date-fns";
import type { TicketMetadata } from "@/db/types";

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

  if (!data) notFound();

  const { ticket, category, subcategory, subSubcategory, creator, student, assignedStaff, spoc, profileFields, dynamicFields, comments, sla } = data;
  const metadata = (ticket.metadata as TicketMetadata) || {};

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
  // buildTimeline expects status as string value, not object
  const timelineEntries = buildTimeline(ticket, statusValue || "");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      {/* 1. Ticket Header */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="space-y-3">
            <CardTitle className="text-3xl md:text-4xl font-bold">
              Ticket #{ticket.id}
            </CardTitle>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Category:</span>
                <Badge variant="outline" className="font-medium">
                  {category?.name || "Unknown"}
                </Badge>
              </div>

              {subcategory && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Subcategory:</span>
                  <Badge variant="outline" className="font-medium">
                    Issue Type → {subcategory.name}
                  </Badge>
                </div>
              )}

              {subSubcategory && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Sub-type:</span>
                  <Badge variant="outline" className="font-medium">
                    {subSubcategory.name}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Ticket Status:</span>
                <TicketStatusBadge status={ticket.status} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 2. Student Information - Dynamic based on category profile fields */}
          {resolvedProfileFields.length > 0 && (
            <section className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4" />
                <h3 className="text-base font-semibold">Student Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolvedProfileFields.map((field) => (
                  <div key={field.field_name}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {field.label}
                    </p>
                    <p className="text-sm font-semibold">{field.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Submitted Information (All fields they submitted) */}
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-5 h-5" />
                Submitted Information
              </CardTitle>
              <CardDescription>
                Details provided when creating this ticket
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location */}
              {ticket.location && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</p>
                  <p className="text-base font-medium">{ticket.location}</p>
                </div>
              )}

              {/* Issue Type (Subcategory) */}
              {subcategory && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue Type</p>
                  <p className="text-base font-medium">{subcategory.name}</p>
                </div>
              )}

              {/* Sub-type (Sub-subcategory) */}
              {subSubcategory && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sub-type</p>
                  <p className="text-base font-medium">{subSubcategory.name}</p>
                </div>
              )}

              {/* Description */}
              {ticket.description && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                  <p className="text-base whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                </div>
              )}

              {/* Attachments */}
              {metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Attachments</p>
                  <ImageLightbox images={metadata.images} />
                </div>
              )}

              {/* Additional Dynamic Fields */}
              {dynamicFields.length > 0 && (
                <div className="space-y-2">
                  {dynamicFields.map((field) => (
                    <DynamicFieldDisplay key={field.key} field={field} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Assignment Information */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-4 h-4" />
              <h3 className="text-base font-semibold">Assignment Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Assigned To</p>
                <p className="text-sm font-semibold">
                  {assignedStaff ? assignedStaff.name : "Not assigned yet"}
                </p>
              </div>
              {spoc && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">SPOC (Point of Contact)</p>
                  <p className="text-sm font-semibold">{spoc.name}</p>
                </div>
              )}
              {sla.expectedAckTime && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Expected Acknowledgement Time</p>
                  <p className="text-sm font-semibold">{sla.expectedAckTime}</p>
                </div>
              )}
              {sla.expectedResolutionTime && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Expected Resolution Time</p>
                  <p className="text-sm font-semibold">{sla.expectedResolutionTime}</p>
                </div>
              )}
            </div>
          </section>

          {/* 5. Ticket Progress */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" />
              <h3 className="text-base font-semibold">Ticket Progress</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Progress</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{ticketProgress}%</span>
                  <TicketStatusBadge status={ticket.status} />
                </div>
              </div>
              <Progress value={ticketProgress} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 flex-wrap gap-2">
                <span>10% – OPEN</span>
                <span>30% – ACKNOWLEDGED</span>
                <span>50% – IN PROGRESS</span>
                <span>70% – AWAITING STUDENT</span>
                <span>100% – RESOLVED</span>
              </div>
            </div>
          </section>

          {/* 6. Timeline */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <CalendarCheck className="w-4 h-4" />
              <h3 className="text-base font-semibold">Timeline</h3>
            </div>
            <div className="space-y-3">
              {timelineEntries.map((entry: Record<string, unknown>, index: number) => {
                // Safeguard against missing icon - fallback to AlertCircle
                const iconKey = typeof entry.icon === 'string' ? entry.icon : '';
                const IconComponent = ICON_MAP[iconKey] ?? AlertCircle;
                const title = typeof entry.title === 'string' ? entry.title : '';
                const entryDate = entry.date && (typeof entry.date === 'string' || entry.date instanceof Date) ? entry.date : null;
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeof entry.color === 'string' ? entry.color : ''}`}>
                      <IconComponent className={`w-4 h-4 ${typeof entry.textColor === 'string' ? entry.textColor : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        {title}
                      </p>
                      {entryDate && (
                        <>
                          <p className="text-sm font-semibold">
                            {format(entryDate, 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(entryDate, 'h:mm a')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7. Comments / Conversation */}
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageSquare className="w-5 h-5" />
                Comments / Conversation
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {comments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length > 0 ? (
                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="space-y-4">
                    {comments.map((comment: Record<string, unknown>, idx: number) => {
                      const commentText = typeof comment.text === 'string' ? comment.text : '';
                      const commentAuthor = typeof comment.author === 'string' ? comment.author : null;
                      const commentCreatedAt = comment.created_at && (typeof comment.created_at === 'string' || comment.created_at instanceof Date) ? comment.created_at : null;
                      return (
                        <div key={idx} className="rounded-lg border bg-gradient-to-br from-muted/50 to-muted/30 p-4">
                          <p className="text-base whitespace-pre-wrap leading-relaxed mb-3 text-foreground">
                            {commentText}
                          </p>
                          <Separator className="my-3" />
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {commentAuthor && (
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                <span className="font-medium">{commentAuthor}</span>
                              </div>
                            )}
                            {commentCreatedAt && (
                              <>
                                <span className="text-muted-foreground/50">•</span>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{format(commentCreatedAt, 'MMM d, yyyy h:mm a')}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No comments yet</p>
                  <p className="text-xs mt-1">Updates and responses will appear here</p>
                </div>
              )}

              {/* Students can reply only when admin asked a question */}
              {normalizedStatus === "awaiting_student_response" && (
                <div className="pt-4 border-t">
                  <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <span className="font-medium text-amber-900 dark:text-amber-100">
                        Admin has asked a question. Please respond below.
                      </span>
                    </AlertDescription>
                  </Alert>
                  <CommentForm ticketId={ticket.id} currentStatus={statusValue || undefined} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating after closed/resolved */}
          {(normalizedStatus === "closed" || normalizedStatus === "resolved") && (
            <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Rate Your Experience
                </CardTitle>
                <CardDescription>
                  Help us improve by rating your ticket resolution experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RatingForm ticketId={ticket.id} currentRating={ticket.rating ? ticket.rating.toString() : undefined} />
              </CardContent>
            </Card>
          )}

          {/* 8. Actions Available to Student */}
          <StudentActions
            ticketId={ticket.id}
            currentStatus={statusValue || "open"}
          />

          {/* 9. Attachments */}
          {ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
            <section className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4" />
                <h3 className="text-base font-semibold">Attachments</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {ticket.attachments.map((attachment: { url: string }, index: number) => (
                  <div key={index} className="relative group">
                    <img
                      src={attachment.url}
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(attachment.url, '_blank')}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium">
                        View Full Size
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 10. System Information */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              <h3 className="text-base font-semibold">System Information</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Internal details visible to student
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Escalation Level</span>
                <span className="text-sm font-semibold">{ticket.escalation_level ?? 0}</span>
              </div>
            </div>
          </section>

        </CardContent>
      </Card>
    </div>
  );
}
