import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar } from "lucide-react";
import { CommentForm } from "@/components/tickets/CommentForm";
import { AdminActions } from "@/components/tickets/AdminActions";
import { StudentActions } from "@/components/tickets/StudentActions";
import { RatingForm } from "@/components/tickets/RatingForm";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const { ticketId } = await params;
  const id = parseInt(ticketId);

  if (isNaN(id)) {
    notFound();
  }

  const ticket = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);

  if (ticket.length === 0) {
    notFound();
  }

  const ticketData = ticket[0];
  
  // Get user role
  const role = sessionClaims?.metadata?.role;
  const isAdmin = role === "admin" || role === "super_admin";
  
  // Check if student owns this ticket
  let isOwner = false;
  if (!isAdmin) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;
      isOwner = userNumber === ticketData.userNumber;
    } catch (error) {
      console.error("Error checking ticket ownership:", error);
    }
  }
  
  // Parse details JSON to get TAT and comments
  let details: any = {};
  if (ticketData.details) {
    try {
      details = JSON.parse(ticketData.details);
    } catch (e) {
      console.error("Error parsing details:", e);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>

          <div className="border rounded-lg p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h1 className="text-3xl font-bold">Ticket #{ticketData.id}</h1>
                <div className="flex items-center gap-2">
                  {ticketData.status && (
                    <Badge
                      variant="outline"
                      className={
                        ticketData.status === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent' :
                        ticketData.status === 'reopened' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-transparent' :
                        ticketData.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-transparent' :
                        ticketData.status === 'awaiting_student_response' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-transparent' :
                        ticketData.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-transparent' :
                        ticketData.status === 'closed' ? 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent' :
                        'bg-muted text-foreground'
                      }
                    >
                      {ticketData.status.replaceAll('_', ' ')}
                    </Badge>
                  )}
                  {ticketData.escalationCount && ticketData.escalationCount !== '0' && (
                    <Badge variant="destructive">Escalated × {ticketData.escalationCount}</Badge>
                  )}
                  <Badge variant="outline">{ticketData.category}</Badge>
                </div>
              </div>
              {ticketData.subcategory && (
                <p className="text-muted-foreground text-sm">{ticketData.subcategory}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">User Number</label>
                <p className="text-lg">{ticketData.userNumber}</p>
              </div>

              {ticketData.location && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-lg">{ticketData.location}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-lg whitespace-pre-wrap">
                  {ticketData.description || "No description provided"}
                </p>
              </div>

              {details.tat && (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <label className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1 block">
                    ⏱️ Turnaround Time (TAT)
                  </label>
                  <p className="text-lg text-blue-800 dark:text-blue-200">
                    {details.tat}
                  </p>
                  {details.tatDate && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Target Date: {new Date(details.tatDate).toLocaleDateString()} {new Date(details.tatDate).toLocaleTimeString()}
                    </p>
                  )}
                  {details.tatSetBy && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Set by {details.tatSetBy} on {details.tatSetAt ? new Date(details.tatSetAt).toLocaleString() : ""}
                      {details.tatExtendedAt && ` • Extended on ${new Date(details.tatExtendedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  💬 Comments {details.comments && details.comments.length > 0 && `(${details.comments.length})`}
                </label>
                
                {details.comments && details.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {details.comments
                      .filter((comment: any) => {
                        // Students only see student-visible comments, not internal notes
                        if (!isAdmin && comment.isInternal) {
                          return false;
                        }
                        return true;
                      })
                      .map((comment: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`border rounded-lg p-4 ${
                          comment.type === "super_admin_note" 
                            ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800" 
                            : comment.isInternal 
                            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" 
                            : "bg-muted/50"
                        }`}
                      >
                        {comment.type === "super_admin_note" && (
                          <div className="mb-2">
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Super Admin Note
                            </Badge>
                          </div>
                        )}
                        {comment.isInternal && comment.type !== "super_admin_note" && (
                          <div className="mb-2">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Internal Note
                            </Badge>
                          </div>
                        )}
                        <p className="text-base whitespace-pre-wrap">{comment.text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>By {comment.author}</span>
                          {comment.createdAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(comment.createdAt).toLocaleString()}</span>
                            </>
                          )}
                          {comment.source && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{comment.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Students can reply only when admin asked a question */}
                {(!isAdmin && isOwner && ticketData.status === "awaiting_student_response") && (
                  <CommentForm ticketId={ticketData.id} currentStatus={ticketData.status || undefined} />
                )}
              </div>

              {isAdmin && (
                <AdminActions 
                  ticketId={ticketData.id} 
                  currentStatus={ticketData.status || "open"}
                  hasTAT={!!details.tat}
                  isPublic={ticketData.isPublic === "true"}
                />
              )}

              {/* Rating Form - Show for closed/resolved tickets */}
              {(ticketData.status === "closed" || ticketData.status === "resolved") && !isAdmin && isOwner && (
                <div className="border-t pt-4">
                  <RatingForm 
                    ticketId={ticketData.id} 
                    currentRating={ticketData.rating || undefined}
                  />
                </div>
              )}

              {!isAdmin && isOwner && (
                <StudentActions 
                  ticketId={ticketData.id} 
                  currentStatus={ticketData.status || "open"}
                  escalationCount={ticketData.escalationCount || "0"}
                />
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Created {ticketData.createdAt?.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
    </div>
  );
}

