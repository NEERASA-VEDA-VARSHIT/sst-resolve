import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Clock, AlertCircle, MessageSquare, User, MapPin, FileText, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { db, tickets, ticket_committee_tags, committees, categories, ticket_statuses } from "@/db";
import { eq, inArray, and } from "drizzle-orm";
import type { TicketMetadata } from "@/db/inferred-types";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { CommentForm } from "@/components/tickets/CommentForm";
import { RatingForm } from "@/components/tickets/RatingForm";
import { CommitteeActions } from "@/components/tickets/CommitteeActions";
import { normalizeStatusForComparison, formatStatus } from "@/lib/utils";

export default async function CommitteeTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  // Fetch ticket with category join
  const ticketRows = await db
    .select({
      id: tickets.id,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      description: tickets.description,
      location: tickets.location,
      created_by: tickets.created_by,
      category_id: tickets.category_id,
      metadata: tickets.metadata,
      due_at: tickets.resolution_due_at,
      created_at: tickets.created_at,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(eq(tickets.id, id))
    .limit(1);

  if (ticketRows.length === 0) notFound();
  const ticket = ticketRows[0];

  // Ensure user exists and get user_id
  const user = await getOrCreateUser(userId);

  // Get committee IDs this user is the head of (using head_id)
  const committeeRecords = await db
    .select({ id: committees.id })
    .from(committees)
    .where(eq(committees.head_id, user.id));

  const committeeIds = committeeRecords.map(c => c.id);

  // Check if ticket is created by this committee member OR tagged to their committee
  let canAccess = false;

  // Check if ticket is created by this committee member
  if (ticket.created_by === user.id && ticket.category_name === "Committee") {
    canAccess = true;
  }

  // Check if ticket is tagged to any of the user's committees
  if (!canAccess && committeeIds.length > 0) {
    const tagRecords = await db
      .select()
      .from(ticket_committee_tags)
      .where(
        and(
          eq(ticket_committee_tags.ticket_id, id),
          inArray(ticket_committee_tags.committee_id, committeeIds)
        )
      )
      .limit(1);

    if (tagRecords.length > 0) {
      canAccess = true;
    }
  }

  if (!canAccess) {
    redirect("/committee/dashboard");
  }

  // Check if this ticket is tagged to user's committee
  const isTaggedTicket = committeeIds.length > 0 && (await db
    .select()
    .from(ticket_committee_tags)
    .where(
      and(
        eq(ticket_committee_tags.ticket_id, id),
        inArray(ticket_committee_tags.committee_id, committeeIds)
      )
    )
    .limit(1)).length > 0;

  // Parse metadata (JSONB) for comments and rating
  type TicketMetadataWithComments = TicketMetadata;
  const metadata = (ticket.metadata as TicketMetadataWithComments) || {};
  const comments = Array.isArray(metadata?.comments) ? metadata.comments : [];
  const visibleComments = comments.filter(
    (c: { type?: string }) => c.type !== "internal_note" && c.type !== "super_admin_note"
  );
  const rating = (metadata.rating as number | null) || null;

  // Normalize status for comparisons
  const normalizedStatus = normalizeStatusForComparison(ticket.status_value);

  const statusVariant = (status: string | null | undefined) => {
    const normalized = normalizeStatusForComparison(status);
    switch (normalized) {
      case "open":
      case "reopened":
        return "default" as const;
      case "in_progress":
        return "secondary" as const;
      case "awaiting_student_response":
        return "outline" as const;
      case "resolved":
        return "default" as const;
      case "closed":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const getStatusColor = (status: string | null | undefined) => {
    const normalized = normalizeStatusForComparison(status);
    switch (normalized) {
      case "open":
      case "reopened":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      case "in_progress":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
      case "awaiting_student_response":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800";
      case "resolved":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
      case "closed":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
      default:
        return "bg-muted text-foreground";
    }
  };

  // Calculate ticket progress
  const getTicketProgress = () => {
    switch (normalizedStatus) {
      case "closed":
      case "resolved":
        return 100;
      case "in_progress":
        return 50;
      case "awaiting_student_response":
        return 30;
      default:
        return 10;
    }
  };

  // TAT info
  let tatInfo: { date: Date; daysRemaining: number; isOverdue: boolean } | null = null;
  const tatDate = ticket.due_at || (metadata?.tatDate ? new Date(metadata.tatDate) : null);
  if (tatDate) {
    try {
      const now = new Date();
      const diffTime = tatDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      tatInfo = {
        date: tatDate,
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
      };
    } catch { }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/committee/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-3xl font-bold">Ticket #{ticket.id}</CardTitle>
                {ticket.status_value && (
                  <Badge variant={statusVariant(ticket.status_value)} className={getStatusColor(ticket.status_value)}>
                    {formatStatus(ticket.status_value)}
                  </Badge>
                )}
                {ticket.category_name && (
                  <Badge variant="outline">{ticket.category_name}</Badge>
                )}
              </div>
              {metadata?.subcategory && (
                <CardDescription className="text-base">
                  {metadata.subcategory}
                </CardDescription>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Ticket Progress</span>
              <span className="font-semibold">{getTicketProgress()}%</span>
            </div>
            <Progress value={getTicketProgress()} className="h-2" />
          </div>

          {/* TAT Alert */}
          {tatInfo && (
            <Alert className={tatInfo.isOverdue ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"}>
              <Clock className={`h-4 w-4 ${tatInfo.isOverdue ? "text-red-600" : "text-blue-600"}`} />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className={tatInfo.isOverdue ? "text-red-900 dark:text-red-100 font-medium" : "text-blue-900 dark:text-blue-100 font-medium"}>
                    {tatInfo.isOverdue
                      ? `⚠️ TAT Overdue by ${Math.abs(tatInfo.daysRemaining)} day${Math.abs(tatInfo.daysRemaining) !== 1 ? 's' : ''}`
                      : `⏰ TAT: ${tatInfo.daysRemaining > 0 ? `${tatInfo.daysRemaining} day${tatInfo.daysRemaining !== 1 ? 's' : ''} remaining` : 'Due today'}`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tatInfo.date.toLocaleDateString()}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Committee Member</p>
                    <p className="text-lg font-semibold">You</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {ticket.location && (
              <Card className="border bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="text-lg font-semibold">{ticket.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border bg-muted/30 md:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                      <p className="text-base whitespace-pre-wrap leading-relaxed">
                        {ticket.description || "No description provided"}
                      </p>
                    </div>

                    {/* Display Images if available */}
                    {metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0 && (
                      <div className="space-y-2 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-muted-foreground">Attached Images</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {metadata.images.map((imageUrl: string, index: number) => (
                            <a
                              key={index}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Comments Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments
                {visibleComments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {visibleComments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleComments.length > 0 ? (
                <div className="space-y-3">
                  {visibleComments.map((comment: Record<string, unknown>, idx: number) => (
                    <Card key={idx} className="border bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                          {typeof comment.text === 'string' ? comment.text : ''}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{typeof comment.author === 'string' ? comment.author : "Unknown"}</span>
                          {(() => {
                            const createdAt = comment.createdAt;
                            if (!createdAt) return null as React.ReactNode;
                            if (typeof createdAt === 'string') {
                              return <span>{new Date(createdAt).toLocaleString()}</span>;
                            }
                            if (createdAt instanceof Date) {
                              return <span>{createdAt.toLocaleString()}</span>;
                            }
                            return null as React.ReactNode;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Super Admin will respond here.
                </p>
              )}

              {/* Comment form - only show if status allows */}
              {normalizedStatus === "awaiting_student_response" && (
                <div className="pt-4 border-t">
                  <Alert className="mb-4 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <span className="font-medium text-amber-900 dark:text-amber-100">
                        Super Admin has asked a question. Please respond below.
                      </span>
                    </AlertDescription>
                  </Alert>
                  <CommentForm ticketId={ticket.id} currentStatus={ticket.status_value || undefined} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Committee Actions - for tagged tickets */}
          {isTaggedTicket && (
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  Committee Actions
                </CardTitle>
                <CardDescription>
                  This ticket was tagged to your committee. You can add comments and close it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CommitteeActions
                  ticketId={ticket.id}
                  currentStatus={ticket.status_value || "open"}
                  isTaggedTicket={isTaggedTicket}
                />
              </CardContent>
            </Card>
          )}

          {/* Rating Form - only show for resolved tickets without rating */}
          {normalizedStatus === "resolved" && !rating && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Rate Your Experience
                </CardTitle>
                <CardDescription>
                  Help us improve by rating your ticket resolution experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RatingForm ticketId={ticket.id} currentRating={rating ? String(rating) : undefined} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

