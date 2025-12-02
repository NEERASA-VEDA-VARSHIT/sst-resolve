import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { canCommitteeAccessTicket } from "@/lib/ticket/committeeAccess";
import { getCommitteeTicketData } from "@/lib/ticket/getCommitteeTicketData";
import { resolveProfileFields } from "@/lib/ticket/profileFieldResolver";
import { buildTimeline } from "@/lib/ticket/buildTimeline";
import { enrichTimelineWithTAT } from "@/lib/ticket/enrichTimeline";
import { parseTicketMetadata, extractImagesFromMetadata } from "@/lib/ticket/parseTicketMetadata";
import { calculateTATInfo } from "@/lib/ticket/calculateTAT";
import { normalizeStatusForComparison } from "@/lib/utils";
import { getTicketStatuses, buildProgressMap } from "@/lib/status/getTicketStatuses";
import { CommitteeTicketHeader } from "@/components/committee/ticket/CommitteeTicketHeader";
import { TicketQuickInfo } from "@/components/student/ticket/TicketQuickInfo";
import { TicketSubmittedInfo } from "@/components/student/ticket/TicketSubmittedInfo";
import { TicketTimeline } from "@/components/student/ticket/TicketTimeline";
import { AdminCommentComposer } from "@/components/tickets/AdminCommentComposer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { TicketRating } from "@/components/student/ticket/TicketRating";
import { TicketTATInfo } from "@/components/student/ticket/TicketTATInfo";
import { TicketStudentInfo } from "@/components/student/ticket/TicketStudentInfo";
import { CommitteeActions } from "@/components/committee/ticket/CommitteeActions";
import type { TicketStatusDisplay, TicketComment, TicketTimelineEntry, ResolvedProfileField, TATInfo } from "@/types/ticket";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function CommitteeTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) {
    console.error('[Committee Ticket Page] Failed to create/fetch user');
    notFound();
  }

  // Check access first
  const canAccess = await canCommitteeAccessTicket(id, dbUser.id);
  if (!canAccess) {
    redirect("/committee/dashboard");
  }

  // Show admin actions for all committee tickets (both created and tagged)
  // Since canAccess is true, the user has permission to view and act on this ticket

  // Fetch ticket data
  const [data, ticketStatuses] = await Promise.all([
    getCommitteeTicketData(id),
    getTicketStatuses(),
  ]);

  if (!data) {
    notFound();
  }

  const { ticket, category, subcategory, subSubcategory, creator, student, assignedStaff, profileFields, dynamicFields, comments } = data;

  // Normalize subSubcategory
  const normalizedSubSubcategory = subSubcategory &&
    typeof subSubcategory.id === 'number' &&
    typeof subSubcategory.name === 'string' &&
    typeof subSubcategory.slug === 'string'
      ? { id: subSubcategory.id, name: subSubcategory.name, slug: subSubcategory.slug }
      : null;

  // Parse metadata
  const metadata = parseTicketMetadata(ticket.metadata);
  const images = extractImagesFromMetadata(metadata);

  // Build status display
  const statusValue = ticket.status?.value || null;
  const normalizedStatus = normalizeStatusForComparison(statusValue);
  const statusDisplay: TicketStatusDisplay | null = ticket.status
    ? { value: ticket.status.value, label: ticket.status.label, badge_color: ticket.status.badge_color }
    : null;

  // Calculate progress
  const progressMap = buildProgressMap(ticketStatuses);
  const ticketProgress = progressMap[normalizedStatus] || 0;

  // Calculate TAT info
  const tatInfo: TATInfo = calculateTATInfo(ticket, { normalizedStatus, ticketProgress });

  // Extract date fields from metadata for timeline
  const acknowledged_at = metadata.acknowledged_at 
    ? (typeof metadata.acknowledged_at === 'string' ? new Date(metadata.acknowledged_at) : metadata.acknowledged_at instanceof Date ? metadata.acknowledged_at : null)
    : null;
  const resolved_at = metadata.resolved_at 
    ? (typeof metadata.resolved_at === 'string' ? new Date(metadata.resolved_at) : metadata.resolved_at instanceof Date ? metadata.resolved_at : null)
    : null;
  const reopened_at = metadata.reopened_at 
    ? (typeof metadata.reopened_at === 'string' ? new Date(metadata.reopened_at) : metadata.reopened_at instanceof Date ? metadata.reopened_at : null)
    : null;

  // Build timeline with complete ticket data
  const ticketForTimeline = {
    ...ticket,
    acknowledged_at,
    resolved_at,
    reopened_at,
  };
  const baseTimeline = buildTimeline(ticketForTimeline, normalizedStatus);
  const timelineEntries: TicketTimelineEntry[] = enrichTimelineWithTAT(baseTimeline, ticket, { normalizedStatus, ticketProgress });

  // Resolve profile fields
  const resolvedProfileFields: ResolvedProfileField[] = resolveProfileFields(
    profileFields,
    metadata,
    student ? { hostel_id: student.hostel_id, hostel_name: student.hostel_name, room_no: student.room_no } : undefined,
    creator ? { name: creator.name, email: creator.email } : undefined
  );

  // Normalize comments
  const normalizedComments: TicketComment[] = (comments || []).map((c: unknown) => {
    const comment = c as Record<string, unknown>;
    const createdAtValue = comment.createdAt || comment.created_at;
    let normalizedCreatedAt: string | Date | null = null;
    if (createdAtValue) {
      if (typeof createdAtValue === 'string') {
        normalizedCreatedAt = createdAtValue;
      } else if (createdAtValue instanceof Date) {
        normalizedCreatedAt = createdAtValue;
      } else if (createdAtValue && typeof createdAtValue === 'object' && 'toISOString' in createdAtValue) {
        normalizedCreatedAt = new Date((createdAtValue as { toISOString: () => string }).toISOString());
      }
    }
    return {
      text: typeof comment.text === 'string' ? comment.text : '',
      author: typeof comment.author === 'string' ? comment.author : undefined,
      createdAt: normalizedCreatedAt,
      created_at: normalizedCreatedAt,
      source: typeof comment.source === 'string' ? comment.source : undefined,
      type: typeof comment.type === 'string' ? comment.type : undefined,
      isInternal: typeof comment.isInternal === 'boolean' ? comment.isInternal : undefined,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <CommitteeTicketHeader
          ticketId={ticket.id}
          status={statusDisplay}
          categoryName={category?.name || null}
          subcategory={metadata.subcategory ? String(metadata.subcategory) : null}
        />

        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="space-y-6 p-6">
            <TicketQuickInfo
              ticketProgress={ticketProgress}
              normalizedStatus={normalizedStatus}
              assignedStaff={assignedStaff || null}
              tatInfo={tatInfo}
              ticket={ticket}
            />

            <TicketSubmittedInfo
              description={ticket.description}
              location={ticket.location}
              images={images}
              dynamicFields={dynamicFields.map(f => {
                // Normalize value to string | string[]
                let normalizedValue: string | string[] = '';
                if (Array.isArray(f.value)) {
                  normalizedValue = f.value.map(v => String(v));
                } else if (f.value !== null && f.value !== undefined) {
                  normalizedValue = String(f.value);
                }
                return {
                  ...f,
                  type: f.fieldType || 'text',
                  value: normalizedValue,
                };
              })}
            />

            <TicketTimeline entries={timelineEntries} />

            {/* Comments Section - Admin Style */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Comments
                  {normalizedComments.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {normalizedComments.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {normalizedComments.length > 0 ? (
                  <ScrollArea className="max-h-[500px] pr-4">
                    <div className="space-y-4">
                      {normalizedComments.map((comment, idx) => {
                        const isInternal = comment.isInternal || comment.type === "internal_note" || comment.type === "super_admin_note";
                        const commentText = comment.text || '';
                        const commentAuthor = comment.author || 'Unknown';
                        const commentSource = comment.source;
                        const commentCreatedAt = comment.createdAt || comment.created_at;
                        
                        // For internal notes, use card style
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

            {(normalizedStatus === "closed" || normalizedStatus === "resolved") && (
              <TicketRating
                ticketId={ticket.id}
                currentRating={ticket.rating ? String(ticket.rating) : undefined}
              />
            )}

            {/* Show admin actions for all committee tickets (both created and tagged) */}
            <CommitteeActions
              ticketId={ticket.id}
              currentStatus={statusValue || "open"}
              hasTAT={!!tatInfo.expectedResolution}
              categoryName={category?.name || null}
              location={ticket.location}
            />

            <TicketTATInfo tatInfo={tatInfo} />

            {(ticket.escalation_level ?? 0) > 0 && (
              <Card className="border-2 bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Escalation Level</span>
                    <span className="text-sm font-semibold">{ticket.escalation_level}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <TicketStudentInfo profileFields={resolvedProfileFields} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

