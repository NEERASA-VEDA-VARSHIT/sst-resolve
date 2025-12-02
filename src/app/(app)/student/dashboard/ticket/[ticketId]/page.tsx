import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getFullTicketData } from "@/lib/ticket/getFullTicketData";
import { resolveProfileFields } from "@/lib/ticket/profileFieldResolver";
import { buildTimeline } from "@/lib/ticket/buildTimeline";
import { enrichTimelineWithTAT } from "@/lib/ticket/enrichTimeline";
import { parseTicketMetadata, extractImagesFromMetadata } from "@/lib/ticket/parseTicketMetadata";
import { calculateTATInfo } from "@/lib/ticket/calculateTAT";
import { normalizeStatusForComparison } from "@/lib/utils";
import { getTicketStatuses, buildProgressMap } from "@/lib/status/getTicketStatuses";
import { TicketHeader } from "@/components/student/ticket/TicketHeader";
import { TicketQuickInfo } from "@/components/student/ticket/TicketQuickInfo";
import { TicketSubmittedInfo } from "@/components/student/ticket/TicketSubmittedInfo";
import { TicketTimeline } from "@/components/student/ticket/TicketTimeline";
import { TicketConversation } from "@/components/student/ticket/TicketConversation";
import { TicketRating } from "@/components/student/ticket/TicketRating";
import { TicketTATInfo } from "@/components/student/ticket/TicketTATInfo";
import { TicketStudentInfo } from "@/components/student/ticket/TicketStudentInfo";
import { StudentActions } from "@/components/tickets/StudentActions";
import type { TicketStatusDisplay, TicketComment, TicketTimelineEntry, ResolvedProfileField, TATInfo } from "@/types/ticket";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function StudentTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) {
    console.error('[Student Ticket Page] Failed to create/fetch user');
    notFound();
  }

  const [data, ticketStatuses] = await Promise.all([
    getFullTicketData(id, dbUser.id),
    getTicketStatuses(),
  ]);

  if (!data || data.ticket.created_by !== dbUser.id) {
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
    : ticket.acknowledged_at;
  const resolved_at = metadata.resolved_at 
    ? (typeof metadata.resolved_at === 'string' ? new Date(metadata.resolved_at) : metadata.resolved_at instanceof Date ? metadata.resolved_at : null)
    : ticket.resolved_at;
  const reopened_at = metadata.reopened_at 
    ? (typeof metadata.reopened_at === 'string' ? new Date(metadata.reopened_at) : metadata.reopened_at instanceof Date ? metadata.reopened_at : null)
    : ticket.reopened_at;

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
        <TicketHeader
          ticketId={ticket.id}
          status={statusDisplay}
          category={category}
          subcategory={subcategory}
          subSubcategory={normalizedSubSubcategory}
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

            <TicketConversation
              comments={normalizedComments}
              ticketId={ticket.id}
              status={statusDisplay}
              normalizedStatus={normalizedStatus}
            />

            {(normalizedStatus === "closed" || normalizedStatus === "resolved") && (
              <TicketRating
                ticketId={ticket.id}
                currentRating={ticket.rating ? String(ticket.rating) : undefined}
              />
            )}

            <StudentActions
              ticketId={ticket.id}
              currentStatus={statusValue || "open"}
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
