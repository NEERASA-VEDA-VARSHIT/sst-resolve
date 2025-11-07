import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ArrowLeft, Clock, CheckCircle2, AlertCircle, MessageSquare, User, MapPin, FileText, Image as ImageIcon } from "lucide-react";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { CommentForm } from "@/components/tickets/CommentForm";
import { RatingForm } from "@/components/tickets/RatingForm";

export default async function CommitteeTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const row = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (row.length === 0) notFound();
  const ticket = row[0];

  // Ensure committee member owns this ticket (userNumber is userId for committee)
  if (ticket.userNumber !== userId || ticket.category !== "Committee") {
    redirect("/committee/dashboard");
  }

  // Parse details for comments
  let details: any = {};
  try {
    details = ticket.details ? JSON.parse(ticket.details) : {};
  } catch {
    details = {};
  }

  const statusVariant = (status: string | null | undefined) => {
    switch (status) {
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
    switch (status) {
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

  // Get visible comments (non-internal)
  const allComments = Array.isArray(details.comments) ? details.comments : [];
  const visibleComments = allComments.filter(
    (c: any) => c.type !== "internal_note" && c.type !== "super_admin_note"
  );

  // Calculate ticket progress
  const getTicketProgress = () => {
    if (ticket.status === "closed" || ticket.status === "resolved") return 100;
    if (ticket.status === "in_progress") return 50;
    if (ticket.status === "awaiting_student_response") return 30;
    return 10;
  };

  // TAT info
  let tatInfo: { date: Date; daysRemaining: number; isOverdue: boolean } | null = null;
  if (details.tatDate) {
    try {
      const tatDate = new Date(details.tatDate);
      const now = new Date();
      const diffTime = tatDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      tatInfo = {
        date: tatDate,
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
      };
    } catch {}
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
                {ticket.status && (
                  <Badge variant={statusVariant(ticket.status)} className={getStatusColor(ticket.status)}>
                    {ticket.status.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                )}
                {ticket.category && (
                  <Badge variant="outline">{ticket.category}</Badge>
                )}
              </div>
              {ticket.subcategory && (
                <CardDescription className="text-base">
                  {ticket.subcategory}
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
                    {details.images && Array.isArray(details.images) && details.images.length > 0 && (
                      <div className="space-y-2 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-muted-foreground">Attached Images</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {details.images.map((imageUrl: string, index: number) => (
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
                  {visibleComments.map((comment: any, idx: number) => (
                    <Card key={idx} className="border bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                          {comment.text}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{comment.author || "Unknown"}</span>
                          {comment.createdAt && (
                            <span>
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          )}
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
              {ticket.status === "awaiting_student_response" && (
                <div className="pt-4 border-t">
                  <Alert className="mb-4 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <span className="font-medium text-amber-900 dark:text-amber-100">
                        Super Admin has asked a question. Please respond below.
                      </span>
                    </AlertDescription>
                  </Alert>
                  <CommentForm ticketId={ticket.id} currentStatus={ticket.status || undefined} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating Form - only show for closed/resolved tickets */}
          {ticket.ratingRequired === "true" && !ticket.rating && (
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
                <RatingForm ticketId={ticket.id} currentRating={ticket.rating || undefined} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

