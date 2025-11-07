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
import { StudentActions } from "@/components/tickets/StudentActions";

export default async function StudentTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isFinite(id)) notFound();

  const row = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (row.length === 0) notFound();
  const ticket = row[0];

  // Ensure student owns this ticket
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;
  if (!userNumber || userNumber !== ticket.userNumber) {
    redirect("/student/dashboard");
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
      case "awaiting_student_response":
        return "outline" as const;
      case "closed":
      case "resolved":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const comments: any[] = Array.isArray(details?.comments) ? details.comments : [];
  const visibleComments = comments.filter((c) => !c?.isInternal && c?.type !== "super_admin_note");

  // Calculate ticket progress based on status
  const getTicketProgress = () => {
    switch (ticket.status) {
      case "open": return 20;
      case "in_progress": return 50;
      case "awaiting_student_response": return 70;
      case "resolved": return 90;
      case "closed": return 100;
      default: return 10;
    }
  };

  // Get TAT info if available
  const tatInfo = details?.tatDate ? {
    date: new Date(details.tatDate),
    isOverdue: new Date(details.tatDate).getTime() < new Date().getTime(),
    daysRemaining: Math.ceil((new Date(details.tatDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  } : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Ticket #{ticket.id}
              </CardTitle>
              {ticket.subcategory && (
                <CardDescription className="text-base">
                  {ticket.subcategory}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ticket.status && (
                <Badge 
                  variant={statusVariant(ticket.status)} 
                  className="text-sm px-3 py-1.5 font-semibold"
                >
                  {ticket.status.replaceAll("_", " ")}
                </Badge>
              )}
              {ticket.escalationCount && ticket.escalationCount !== "0" && (
                <Badge variant="destructive" className="animate-pulse">
                  ⚠️ Escalated × {ticket.escalationCount}
                </Badge>
              )}
              <Badge variant="outline" className="font-medium">
                {ticket.category}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-sm">
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
                      : `⏰ TAT: ${tatInfo.daysRemaining > 0 ? `${tatInfo.daysRemaining} day${tatInfo.daysRemaining !== 1 ? 's' : ''} remaining` : 'Due today'}`
                    }
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
                    <p className="text-sm font-medium text-muted-foreground">User Number</p>
                    <p className="text-lg font-semibold">{ticket.userNumber}</p>
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
                  {visibleComments.map((comment, idx) => (
                    <Card key={idx} className="border bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-base whitespace-pre-wrap leading-relaxed mb-3">
                          {comment.text}
                        </p>
                        <Separator className="my-2" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {comment.author && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="font-medium">{comment.author}</span>
                            </div>
                          )}
                          {comment.createdAt && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No comments yet</p>
                </div>
              )}

              {/* Students can reply only when admin asked a question */}
              {ticket.status === "awaiting_student_response" && (
                <div className="pt-4 border-t">
                  <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <span className="font-medium text-amber-900 dark:text-amber-100">
                        Admin has asked a question. Please respond below.
                      </span>
                    </AlertDescription>
                  </Alert>
                  <CommentForm ticketId={ticket.id} currentStatus={ticket.status || undefined} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating after closed/resolved */}
          {(ticket.status === "closed" || ticket.status === "resolved") && (
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
                <RatingForm ticketId={ticket.id} currentRating={ticket.rating || undefined} />
              </CardContent>
            </Card>
          )}

          <StudentActions
            ticketId={ticket.id}
            currentStatus={ticket.status || "open"}
            escalationCount={ticket.escalationCount || "0"}
          />

          <Separator />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Created {ticket.createdAt?.toLocaleDateString()}</span>
            </div>
            {ticket.updatedAt && ticket.updatedAt.getTime() !== ticket.createdAt?.getTime() && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Last updated {ticket.updatedAt.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

